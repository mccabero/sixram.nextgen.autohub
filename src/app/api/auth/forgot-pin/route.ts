import { NextResponse } from "next/server";
import { noContent } from "@/server/api/responses";
import { readJsonRecord, readStringField } from "@/server/api/body";
import { AuthServiceError, resetPin } from "@/server/auth/service";

export const runtime = "nodejs";

const sixDigitPinPattern = /^\d{6}$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = await readJsonRecord(request);
  const username = readStringField(body, "username", "Username");
  const password = readStringField(body, "password", "Password");
  const newPin = readStringField(body, "newPin", "NewPin");
  const confirmPin = readStringField(body, "confirmPin", "ConfirmPin");

  if (
    !body ||
    !username?.trim() ||
    !password?.trim() ||
    !newPin?.trim() ||
    !confirmPin?.trim()
  ) {
    return error("Username, password, new PIN, and confirm PIN are required", 400);
  }

  if (newPin !== confirmPin) {
    return error("PIN and Confirm PIN do not match", 400);
  }

  if (!sixDigitPinPattern.test(newPin)) {
    return error("PIN must be exactly 6 numbers", 400);
  }

  try {
    await resetPin({ username, password, newPin, confirmPin });
    return noContent();
  } catch (cause) {
    if (cause instanceof AuthServiceError) {
      const message =
        cause.status === 401 && cause.message === "Invalid credentials"
          ? "Incorrect username or password"
          : cause.message;

      return error(message, cause.status);
    }

    return error("An unexpected error occurred", 500);
  }
}
