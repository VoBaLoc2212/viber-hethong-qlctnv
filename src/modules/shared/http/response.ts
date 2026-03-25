import { NextResponse } from "next/server";

import type { ApiErrorShape } from "@/modules/shared/contracts/domain";

type JsonObject = Record<string, unknown>;

export function ok(data: JsonObject, meta: JsonObject = {}) {
  return NextResponse.json({ data, meta }, { status: 200 });
}

export function created(data: JsonObject, meta: JsonObject = {}) {
  return NextResponse.json({ data, meta }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function error(status: number, payload: ApiErrorShape) {
  return NextResponse.json(payload, { status });
}
