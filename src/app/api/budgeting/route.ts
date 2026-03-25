import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      data: {
        module: "budgeting",
        endpoints: [
          "GET /api/budgets",
          "POST /api/budgets",
          "GET /api/budgets/:id",
          "PUT /api/budgets/:id",
          "GET /api/budgets/:id/status",
          "POST /api/budgets/:id/transfer",
          "POST /api/controls/hard-stop",
        ],
      },
      meta: {},
    },
    { status: 200 },
  );
}
