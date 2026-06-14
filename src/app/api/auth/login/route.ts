import { NextResponse } from "next/server";
import { readJsonRecord, readStringField } from "@/server/api/body";
import { AuthServiceError, login } from "@/server/auth/service";

export const runtime = "nodejs";

const sixDigitPinPattern = /^\d{6}$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = await readJsonRecord(request);
  const email = readStringField(body, "email", "Email");
  const password = readStringField(body, "password", "Password");
  const pin = readStringField(body, "pin", "Pin");

  if (!body || (!password?.trim() && !pin?.trim())) {
    return error("Username and password or PIN are required", 400);
  }

  if (!pin?.trim() && !email?.trim()) {
    return error("Username and password are required", 400);
  }

  if (pin?.trim() && !sixDigitPinPattern.test(pin)) {
    return error("PIN must be exactly 6 numbers", 400);
  }

  try {
    return NextResponse.json(await login({ email, password, pin }));
  } catch (cause) {
    if (cause instanceof AuthServiceError) {
      const message =
        cause.message === "Invalid credentials"
          ? "Incorrect username, password, or PIN"
          : cause.message;

      return error(message, cause.status);
    }

    return error("An unexpected error occurred", 500);
  }
}
