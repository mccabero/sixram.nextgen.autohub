import { NextResponse } from "next/server";

export function legacyError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message = "Bad request") {
  return legacyError(message, 400);
}

export function unauthorized(message = "Unauthorized") {
  return legacyError(message, 401);
}

export function forbidden(message = "Forbidden") {
  return legacyError(message, 403);
}

export function notFound(message?: string) {
  if (!message) {
    return new NextResponse(null, { status: 404 });
  }

  return legacyError(message, 404);
}

export function serverError(message = "An unexpected error occurred") {
  return legacyError(message, 500);
}
