import { NextResponse } from "next/server";

export type ProblemDetails = {
  title: string;
  status: number;
  detail?: string;
  code?: string;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function problem(details: ProblemDetails) {
  return NextResponse.json(details, { status: details.status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}
