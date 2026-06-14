#!/usr/bin/env node

import "dotenv/config";

import { spawn } from "node:child_process";
import pg from "pg";

const { Client } = pg;

const args = new Set(process.argv.slice(2));
const resetTarget = args.has("--reset-target");
const reconcileOnly = args.has("--reconcile-only");
const batchSize = Number.parseInt(process.env.ETL_BATCH_SIZE ?? "250", 10);

const mssqlServer = process.env.MSSQL_SERVER ?? ".\\SQLEXPRESS";
const mssqlDatabase = process.env.MSSQL_DATABASE ?? "SixramNextGenRapide_Audit";
const mssqlUser = process.env.MSSQL_USER;
const mssqlPassword = process.env.MSSQL_PASSWORD;

const decimalTypes = new Set(["decimal", "numeric", "money", "smallmoney"]);

const decimalChecks = [
  ["Deposits", "DepositAmount"],
  ["Estimates", "TotalAmount"],
  ["Expenses", "Amount"],
  ["Invoices", "TotalAmount"],
  ["JobOrders", "TotalAmount"],
  ["PaymentDetails", "AmountPaid"],
  ["Payments", "TotalPaidAmount"],
  ["PettyCash", "Balance"],
  ["Products", "SellingPrice"],
  ["QuickSales", "TotalAmount"],
];

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
  throw new Error("ETL_BATCH_SIZE must be an integer between 1 and 1000.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the PostgreSQL target.");
}

function msQuote(identifier) {
  return `[${identifier.replaceAll("]", "]]")}]`;
}

function pgQuote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function runSqlcmd(query) {
  const authArgs = mssqlUser
    ? ["-U", mssqlUser, "-P", mssqlPassword ?? ""]
    : ["-E"];

  const sqlcmdArgs = [
    "-S",
    mssqlServer,
    ...authArgs,
    "-d",
    mssqlDatabase,
    "-b",
    "-r",
    "1",
    "-w",
    "65535",
    "-y",
    "0",
    "-Y",
    "0",
    "-Q",
    `SET NOCOUNT ON; ${query}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("sqlcmd", sqlcmdArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`sqlcmd failed with exit code ${code}: ${stderr.trim()}`));
    });
  });
}

async function mssqlJson(query) {
  const output = await runSqlcmd(`${query} FOR JSON PATH, INCLUDE_NULL_VALUES;`);
  const jsonText = output.replace(/^\uFEFF/, "").replace(/\r?\n/g, "").trim();

  if (!jsonText) {
    return [];
  }

  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Expected JSON array from sqlcmd. Received: ${jsonText.slice(0, 200)}`);
  }

  return JSON.parse(jsonText.slice(start, end + 1));
}

async function getSourceMetadata() {
  const [tables, columns, foreignKeys] = await Promise.all([
    mssqlJson(`
      SELECT
        s.name AS SchemaName,
        t.name AS TableName,
        CAST(SUM(p.rows) AS int) AS [RowCount]
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      WHERE t.is_ms_shipped = 0
      GROUP BY s.name, t.name
      ORDER BY t.name
    `),
    mssqlJson(`
      SELECT
        t.name AS TableName,
        c.name AS ColumnName,
        ty.name AS DataType,
        c.column_id AS OrdinalPosition
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id = t.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE t.is_ms_shipped = 0
      ORDER BY t.name, c.column_id
    `),
    mssqlJson(`
      SELECT
        OBJECT_NAME(fk.parent_object_id) AS ChildTable,
        OBJECT_NAME(fk.referenced_object_id) AS ParentTable,
        fk.name AS ForeignKeyName
      FROM sys.foreign_keys fk
      ORDER BY ParentTable, ChildTable, ForeignKeyName
    `),
  ]);

  return { tables, columns, foreignKeys };
}

async function getTargetMetadata(client) {
  const [tablesResult, columnsResult] = await Promise.all([
    client.query(`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `),
    client.query(`
      SELECT
        table_name AS "tableName",
        column_name AS "columnName",
        ordinal_position AS "ordinalPosition"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name, ordinal_position
    `),
  ]);

  return {
    tables: tablesResult.rows.map((row) => row.tableName),
    columns: columnsResult.rows,
  };
}

function groupColumns(columns, tableNameKey) {
  const grouped = new Map();

  for (const column of columns) {
    const tableName = column[tableNameKey];
    const existing = grouped.get(tableName) ?? [];
    existing.push(column);
    grouped.set(tableName, existing);
  }

  return grouped;
}

function compareTableSets(sourceTables, targetTables) {
  const sourceSet = new Set(sourceTables);
  const targetSet = new Set(targetTables);

  return {
    missingInTarget: sourceTables.filter((tableName) => !targetSet.has(tableName)),
    missingInSource: targetTables.filter((tableName) => !sourceSet.has(tableName)),
  };
}

function compareColumns(tableNames, sourceColumnsByTable, targetColumnsByTable) {
  const mismatches = [];

  for (const tableName of tableNames) {
    const sourceColumns = new Set((sourceColumnsByTable.get(tableName) ?? []).map((column) => column.ColumnName));
    const targetColumns = (targetColumnsByTable.get(tableName) ?? []).map((column) => column.columnName);

    const missingInSource = targetColumns.filter((columnName) => !sourceColumns.has(columnName));
    const missingInTarget = [...sourceColumns].filter((columnName) => !targetColumns.includes(columnName));

    if (missingInSource.length > 0 || missingInTarget.length > 0) {
      mismatches.push({ tableName, missingInSource, missingInTarget });
    }
  }

  return mismatches;
}

function getLoadOrder(tableNames, foreignKeys) {
  const tableSet = new Set(tableNames);
  const dependencies = new Map(tableNames.map((tableName) => [tableName, new Set()]));
  const dependents = new Map(tableNames.map((tableName) => [tableName, new Set()]));

  for (const foreignKey of foreignKeys) {
    const child = foreignKey.ChildTable;
    const parent = foreignKey.ParentTable;

    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) {
      continue;
    }

    dependencies.get(child).add(parent);
    dependents.get(parent).add(child);
  }

  const ready = tableNames
    .filter((tableName) => dependencies.get(tableName).size === 0)
    .sort();
  const order = [];

  while (ready.length > 0) {
    const tableName = ready.shift();
    order.push(tableName);

    for (const child of [...dependents.get(tableName)].sort()) {
      dependencies.get(child).delete(tableName);

      if (dependencies.get(child).size === 0) {
        ready.push(child);
        ready.sort();
      }
    }
  }

  if (order.length !== tableNames.length) {
    const unresolved = tableNames.filter((tableName) => !order.includes(tableName));
    throw new Error(`Unable to compute FK-safe load order. Unresolved tables: ${unresolved.join(", ")}`);
  }

  return order;
}

async function getTargetRowCounts(client, tableNames) {
  const counts = new Map();

  for (const tableName of tableNames) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${pgQuote(tableName)}`);
    counts.set(tableName, result.rows[0].count);
  }

  return counts;
}

function buildSelectList(targetColumns, sourceColumns) {
  const sourceColumnByName = new Map(sourceColumns.map((column) => [column.ColumnName, column]));

  return targetColumns.map((targetColumn) => {
    const sourceColumn = sourceColumnByName.get(targetColumn.columnName);

    if (!sourceColumn) {
      throw new Error(`Missing source column ${targetColumn.columnName}.`);
    }

    const quotedColumn = msQuote(targetColumn.columnName);

    if (decimalTypes.has(sourceColumn.DataType)) {
      return `CONVERT(varchar(100), ${quotedColumn}) AS ${quotedColumn}`;
    }

    return quotedColumn;
  });
}

async function getSourceRows(tableName, targetColumns, sourceColumnsByTable) {
  const sourceColumns = sourceColumnsByTable.get(tableName) ?? [];
  const selectList = buildSelectList(targetColumns, sourceColumns);
  const hasId = sourceColumns.some((column) => column.ColumnName === "Id");
  const orderBy = hasId ? " ORDER BY [Id]" : "";

  return mssqlJson(`
    SELECT ${selectList.join(", ")}
    FROM [dbo].${msQuote(tableName)}
    ${orderBy}
  `);
}

async function insertRows(client, tableName, targetColumns, rows) {
  if (rows.length === 0) {
    return;
  }

  const columnNames = targetColumns.map((column) => column.columnName);
  const columnSql = columnNames.map(pgQuote).join(", ");

  for (const rowBatch of chunk(rows, batchSize)) {
    const values = [];
    let parameterIndex = 1;

    const rowSql = rowBatch.map((row) => {
      const placeholders = columnNames.map((columnName) => {
        values.push(row[columnName] ?? null);
        return `$${parameterIndex++}`;
      });

      return `(${placeholders.join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${pgQuote(tableName)} (${columnSql}) VALUES ${rowSql.join(", ")}`,
      values,
    );
  }
}

async function resetSequence(client, tableName) {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, 'Id'),
        COALESCE((SELECT MAX("Id") FROM ${pgQuote(tableName)}), 1),
        (SELECT COUNT(*) > 0 FROM ${pgQuote(tableName)})
      )
    `,
    [`"${tableName}"`],
  );
}

async function resetTargetTables(client, tableNames) {
  await client.query(`TRUNCATE TABLE ${tableNames.map(pgQuote).join(", ")} RESTART IDENTITY CASCADE`);
}

function sumCounts(counts) {
  return [...counts.values()].reduce((total, count) => total + Number(count), 0);
}

async function getDecimalSourceSum(tableName, columnName) {
  const rows = await mssqlJson(`
    SELECT
      CONVERT(varchar(100), COALESCE(SUM(CAST(${msQuote(columnName)} AS decimal(38, 4))), 0)) AS Value
    FROM [dbo].${msQuote(tableName)}
  `);

  return rows[0]?.Value ?? "0.0000";
}

async function getDecimalTargetSum(client, tableName, columnName) {
  const result = await client.query(
    `SELECT COALESCE(SUM(${pgQuote(columnName)}), 0)::text AS value FROM ${pgQuote(tableName)}`,
  );

  return result.rows[0].value;
}

function normalizeDecimal(value, scale = 4) {
  const raw = String(value ?? "0").trim();
  const sign = raw.startsWith("-") ? "-" : "";
  const unsigned = sign ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const normalizedFraction = fraction.padEnd(scale, "0").slice(0, scale);

  return `${sign}${whole}.${normalizedFraction}`;
}

async function getRbacSummary(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "Roles") AS roles,
      (SELECT COUNT(*)::int FROM "Permissions") AS permissions,
      (SELECT COUNT(*)::int FROM "RolePermissions") AS "rolePermissions",
      (SELECT COUNT(*)::int FROM "RolePermissions" WHERE "Allowed" = true) AS "allowedPermissions",
      (SELECT COUNT(*)::int FROM "Users") AS users,
      (SELECT COUNT(*)::int FROM "UserRoles") AS "userRoles"
  `);

  return result.rows[0];
}

async function getTargetConstraintSummary(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*)::int
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = 'public' AND c.contype = 'f') AS "foreignKeys",
      (SELECT COUNT(*)::int
       FROM pg_indexes
       WHERE schemaname = 'public') AS indexes,
      (SELECT COUNT(*)::int
       FROM pg_indexes
       WHERE schemaname = 'public' AND indexdef ILIKE '% WHERE %') AS "partialIndexes",
      (SELECT COUNT(*)::int
       FROM "CompanyInfos"
       WHERE "IsPrimaryCompany" = true) AS "primaryCompanyRows",
      (SELECT COUNT(*)::int
       FROM "InspectionChecklistTemplates"
       WHERE "IsActive" = true) AS "activeInspectionTemplateRows"
  `);

  return result.rows[0];
}

async function reconcile(client, sourceMetadata, targetTableNames) {
  const targetCounts = await getTargetRowCounts(client, targetTableNames);
  const sourceCounts = new Map(sourceMetadata.tables.map((row) => [row.TableName, row.RowCount]));
  const rowMismatches = [];

  for (const tableName of targetTableNames) {
    const sourceCount = Number(sourceCounts.get(tableName) ?? 0);
    const targetCount = Number(targetCounts.get(tableName) ?? 0);

    if (sourceCount !== targetCount) {
      rowMismatches.push({ tableName, sourceCount, targetCount });
    }
  }

  const decimalResults = [];

  for (const [tableName, columnName] of decimalChecks) {
    const [sourceValue, targetValue] = await Promise.all([
      getDecimalSourceSum(tableName, columnName),
      getDecimalTargetSum(client, tableName, columnName),
    ]);
    const normalizedSource = normalizeDecimal(sourceValue);
    const normalizedTarget = normalizeDecimal(targetValue);

    decimalResults.push({
      tableName,
      columnName,
      sourceValue: normalizedSource,
      targetValue: normalizedTarget,
      matches: normalizedSource === normalizedTarget,
    });
  }

  const rbac = await getRbacSummary(client);
  const constraints = await getTargetConstraintSummary(client);

  return {
    sourceTotalRows: [...sourceCounts.values()].reduce((total, count) => total + Number(count), 0),
    targetTotalRows: sumCounts(targetCounts),
    rowMismatches,
    decimalResults,
    rbac,
    constraints,
    tableCounts: targetTableNames.map((tableName) => ({
      tableName,
      sourceCount: Number(sourceCounts.get(tableName) ?? 0),
      targetCount: Number(targetCounts.get(tableName) ?? 0),
    })),
  };
}

function printReconciliation(summary) {
  console.log("");
  console.log("Reconciliation summary");
  console.log("----------------------");
  console.log(`Source rows: ${summary.sourceTotalRows}`);
  console.log(`Target rows: ${summary.targetTotalRows}`);
  console.log(`Row mismatches: ${summary.rowMismatches.length}`);
  console.log(`Decimal mismatches: ${summary.decimalResults.filter((item) => !item.matches).length}`);
  console.log(`Target FKs: ${summary.constraints.foreignKeys}`);
  console.log(`Target indexes: ${summary.constraints.indexes}`);
  console.log(`Target partial indexes: ${summary.constraints.partialIndexes}`);
  console.log(`RBAC: ${JSON.stringify(summary.rbac)}`);
  console.log("");

  if (summary.rowMismatches.length > 0) {
    console.log("Row count mismatches:");
    for (const mismatch of summary.rowMismatches) {
      console.log(`- ${mismatch.tableName}: source=${mismatch.sourceCount}, target=${mismatch.targetCount}`);
    }
  }

  const decimalMismatches = summary.decimalResults.filter((item) => !item.matches);

  if (decimalMismatches.length > 0) {
    console.log("Decimal mismatches:");
    for (const mismatch of decimalMismatches) {
      console.log(
        `- ${mismatch.tableName}.${mismatch.columnName}: source=${mismatch.sourceValue}, target=${mismatch.targetValue}`,
      );
    }
  }
}

async function main() {
  console.log(`MSSQL source: ${mssqlServer} / ${mssqlDatabase}`);
  console.log(`PostgreSQL target: DATABASE_URL is set (${reconcileOnly ? "reconcile only" : "load mode"})`);

  const sourceMetadata = await getSourceMetadata();
  const sourceTableNames = sourceMetadata.tables.map((row) => row.TableName).sort();
  const sourceColumnsByTable = groupColumns(sourceMetadata.columns, "TableName", "ColumnName");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const targetMetadata = await getTargetMetadata(client);
    const targetTableNames = targetMetadata.tables;
    const targetColumnsByTable = groupColumns(targetMetadata.columns, "tableName", "columnName");
    const tableSetDiff = compareTableSets(sourceTableNames, targetTableNames);

    if (tableSetDiff.missingInTarget.length > 0 || tableSetDiff.missingInSource.length > 0) {
      throw new Error(
        `Table mismatch. Missing in target: ${tableSetDiff.missingInTarget.join(", ") || "none"}. Missing in source: ${
          tableSetDiff.missingInSource.join(", ") || "none"
        }.`,
      );
    }

    const columnMismatches = compareColumns(targetTableNames, sourceColumnsByTable, targetColumnsByTable);

    if (columnMismatches.length > 0) {
      throw new Error(`Column mismatch detected: ${JSON.stringify(columnMismatches, null, 2)}`);
    }

    const loadOrder = getLoadOrder(targetTableNames, sourceMetadata.foreignKeys);
    console.log(`Tables: ${targetTableNames.length}`);
    console.log(`Source rows: ${sourceMetadata.tables.reduce((total, row) => total + Number(row.RowCount), 0)}`);

    if (!reconcileOnly) {
      const targetCountsBefore = await getTargetRowCounts(client, targetTableNames);
      const targetRowsBefore = sumCounts(targetCountsBefore);

      if (targetRowsBefore > 0 && !resetTarget) {
        throw new Error(
          `Target app tables already contain ${targetRowsBefore} rows. Rerun with --reset-target only for a dev dry run.`,
        );
      }

      await client.query("BEGIN");

      try {
        if (resetTarget) {
          console.log("Resetting target app tables.");
          await resetTargetTables(client, [...loadOrder].reverse());
        }

        for (const tableName of loadOrder) {
          const targetColumns = targetColumnsByTable.get(tableName) ?? [];
          const rows = await getSourceRows(tableName, targetColumns, sourceColumnsByTable);

          await insertRows(client, tableName, targetColumns, rows);
          await resetSequence(client, tableName);

          console.log(`${tableName}: ${rows.length}`);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const reconciliation = await reconcile(client, sourceMetadata, targetTableNames);
    printReconciliation(reconciliation);

    const hasFailures =
      reconciliation.rowMismatches.length > 0 ||
      reconciliation.decimalResults.some((item) => !item.matches) ||
      Number(reconciliation.constraints.partialIndexes) !== 2;

    if (hasFailures) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
