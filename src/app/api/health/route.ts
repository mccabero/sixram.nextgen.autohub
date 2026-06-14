import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "sixram-nextgen-autohub",
    phase: "phase-1-foundation",
  });
}
