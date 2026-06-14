import { readJsonRecord } from "@/server/api/body";
import { legacyJson } from "@/server/api/legacy-json";
import { authorizeApiRequest } from "@/server/auth/guard";
import {
  generateVoidCode,
  listVoidCodes,
} from "@/server/void-codes/service";
import { voidCodeErrorResponse } from "@/server/void-codes/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const take = Number(new URL(request.url).searchParams.get("take") ?? 25);

  return legacyJson(await listVoidCodes(Number.isInteger(take) ? take : 25));
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const body = await readJsonRecord(request);
  const expiresInMinutes = readExpiresInMinutes(body);

  try {
    return legacyJson(
      await generateVoidCode(authorization.user.userId, expiresInMinutes),
    );
  } catch (error) {
    return voidCodeErrorResponse(error);
  }
}

function readExpiresInMinutes(body: Record<string, unknown> | null) {
  if (!body) return 5;

  const value = body.expiresInMinutes ?? body.ExpiresInMinutes;
  const numberValue =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isInteger(numberValue) ? numberValue : 5;
}
