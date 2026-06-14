import { readJsonRecord } from "@/server/api/body";
import { badRequest, notFound } from "@/server/api/errors";
import { legacyJson } from "@/server/api/legacy-json";
import { parsePositiveInt } from "@/server/api/params";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  deleteExpense,
  getExpense,
  updateExpense,
} from "@/server/operations/expenses";
import { operationErrorResponse } from "@/server/operations/route-helpers";

export const runtime = "nodejs";

type ExpenseContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ExpenseContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const expenseId = parsePositiveInt(id);

  if (!expenseId) {
    return notFound();
  }

  const expense = await getExpense(expenseId);

  return expense ? legacyJson(expense) : notFound();
}

export async function PUT(request: Request, context: ExpenseContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const expenseId = parsePositiveInt(id);

  if (!expenseId) {
    return notFound();
  }

  const body = await readJsonRecord(request);

  if (!body) {
    return badRequest("Request is required.");
  }

  try {
    const updated = await updateExpense(
      expenseId,
      body,
      authorization.user.userId,
    );

    return updated ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: ExpenseContext) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const { id } = await context.params;
  const expenseId = parsePositiveInt(id);

  if (!expenseId) {
    return notFound();
  }

  try {
    const deleted = await deleteExpense(expenseId, authorization.user.userId);

    return deleted ? legacyJson(deleted) : notFound();
  } catch (error) {
    return operationErrorResponse(error);
  }
}

