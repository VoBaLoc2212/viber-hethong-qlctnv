import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      data: {
        module: "auth",
        endpoints: ["POST /api/auth/login", "POST /api/auth/register", "GET /api/auth/me"],
      },
      meta: {},
    },
    { status: 200 },
  );
}
