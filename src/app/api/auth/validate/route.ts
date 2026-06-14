import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/server/auth/guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, []);

  if (!authorization.authorized) {
    return authorization.response;
  }

  return NextResponse.json({ userId: authorization.user.userId });
}
