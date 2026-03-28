import { NextResponse } from "next/server";
import { getStore } from "../_store";

// GET /api/auth - Lấy thông tin user hiện tại
export async function GET() {
  return NextResponse.json(
    {
      data: {
        module: "auth",
        endpoints: ["POST /api/auth/login", "POST /api/auth/logout", "POST /api/auth/register", "GET /api/auth/me"],
      },
      meta: {},
    },
    { status: 200 },
  );
}
