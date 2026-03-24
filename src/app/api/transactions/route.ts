import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ module: "transactions", status: "scaffold" });
}
