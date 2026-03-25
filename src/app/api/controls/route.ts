import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      data: {
        module: "controls",
        endpoints: ["POST /api/controls/hard-stop"],
      },
      meta: {},
    },
    { status: 200 },
  );
}
