import { prisma } from "@/lib/db/prisma/client";

import type { AuthContext } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

import type { AiCitation } from "../types";
import { generateWithGemini } from "./gemini-client";
import { getSqlCache, setSqlCache } from "./memory-service";
import { buildSystemPrompt, buildText2SqlPrompt } from "./prompt-builder";

const FORBIDDEN = /(insert|update|delete|drop|alter|truncate|grant|revoke|copy|;|--|\/\*)/i;
const ALLOWED_TABLES = [/\btransaction\b/i, /\bbudget\b/i, /\bdepartment\b/i, /\bapproval\b/i, /\bfxrate\b/i];

export function ensureSafeSelect(sql: string) {
  const trimmed = sql.trim();

  if (!/^select\s/i.test(trimmed)) {
    throw new AppError("Only SELECT is allowed", "FORBIDDEN");
  }

  if (FORBIDDEN.test(trimmed)) {
    throw new AppError("Unsafe SQL pattern detected", "FORBIDDEN");
  }

  const hasAllowedTable = ALLOWED_TABLES.some((pattern) => pattern.test(trimmed));
  if (!hasAllowedTable) {
    throw new AppError("SQL references table outside allowlist", "FORBIDDEN");
  }

  if (!/\blimit\s+\d+/i.test(trimmed)) {
    return `${trimmed} LIMIT 100`;
  }

  return trimmed;
}

export function applyRoleScope(sql: string, auth: AuthContext) {
  if (auth.role !== "EMPLOYEE") {
    return sql;
  }

  throw new AppError("Text2SQL is unavailable for EMPLOYEE role", "FORBIDDEN");
}

export function normalizeSql(raw: string | null): string {
  if (!raw) {
    throw new AppError("Text2SQL model did not return SQL", "UNPROCESSABLE_ENTITY");
  }

  const oneLine = raw.replace(/```sql|```/gi, "").trim();
  if (oneLine.toUpperCase() === "UNSAFE") {
    throw new AppError("Query was rejected as unsafe by model", "FORBIDDEN");
  }

  return oneLine;
}

export async function resolveByText2Sql(auth: AuthContext, message: string): Promise<{
  answer: string;
  citations: AiCitation[];
  relatedData: Record<string, unknown>;
}> {
  const cached = await getSqlCache(auth.role, message);
  if (cached) {
    return {
      answer: cached.answer,
      citations: [{ source: "sql-cache", snippet: "recent safe query result" }],
      relatedData: cached.relatedData ?? {},
    };
  }

  const sql = normalizeSql(await generateWithGemini(buildText2SqlPrompt(message, buildSystemPrompt(auth))));
  const safeSql = applyRoleScope(ensureSafeSelect(sql), auth);

  const rows = (await prisma.$queryRawUnsafe(safeSql)) as unknown[];

  const answer = rows.length === 0 ? "Không có dữ liệu phù hợp với truy vấn này." : `Đã truy vấn ${rows.length} dòng dữ liệu phù hợp.`;
  const relatedData = { sql: safeSql, rows };

  await setSqlCache(auth.role, message, { answer, relatedData });

  return {
    answer,
    citations: [{ source: "text2sql", snippet: safeSql.slice(0, 200) }],
    relatedData,
  };
}
