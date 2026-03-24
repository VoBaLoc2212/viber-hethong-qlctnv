import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ module: "ai-rag", status: "scaffold" });
}
