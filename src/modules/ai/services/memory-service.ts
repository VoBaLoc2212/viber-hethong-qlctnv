import { createHash } from "node:crypto";

import { getCacheJson, setCacheJson } from "@/lib/cache/redis";

const PREFIX = process.env.REDIS_PREFIX?.trim() || "budget-ai";
const ENV = process.env.NODE_ENV || "development";
const INTENT_TTL = Number(process.env.REDIS_TTL_INTENT_SEC ?? 300);
const SQL_TTL = Number(process.env.REDIS_TTL_SQL_SEC ?? 180);
const RAG_TTL = Number(process.env.REDIS_TTL_RAG_SEC ?? 600);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function key(kind: string, id: string) {
  return `${PREFIX}:${ENV}:${kind}:${id}`;
}

export async function getIntentCache(userId: string, message: string) {
  return getCacheJson<{ intent: string }>(key("intent", `${userId}:${hash(message)}`));
}

export async function setIntentCache(userId: string, message: string, intent: string) {
  await setCacheJson(key("intent", `${userId}:${hash(message)}`), { intent }, INTENT_TTL);
}

export async function getRagCache(input: {
  role: string;
  message: string;
  contextDigest?: string;
  corpusVersion?: string;
}) {
  const scope = `${input.role}:${input.corpusVersion ?? "v0"}:${input.contextDigest ?? "ctx0"}:${hash(input.message)}`;
  return getCacheJson<{ answer: string; citations: Array<{ source: string; snippet: string }> }>(key("rag", scope));
}

export async function setRagCache(
  input: {
    role: string;
    message: string;
    contextDigest?: string;
    corpusVersion?: string;
  },
  value: { answer: string; citations: Array<{ source: string; snippet: string }> },
) {
  const scope = `${input.role}:${input.corpusVersion ?? "v0"}:${input.contextDigest ?? "ctx0"}:${hash(input.message)}`;
  await setCacheJson(key("rag", scope), value, RAG_TTL);
}

export async function getSqlCache(role: string, message: string) {
  return getCacheJson<{ answer: string; relatedData?: Record<string, unknown> }>(
    key("sql", `${role}:${hash(message)}`),
  );
}

export async function setSqlCache(
  role: string,
  message: string,
  value: { answer: string; relatedData?: Record<string, unknown> },
) {
  await setCacheJson(key("sql", `${role}:${hash(message)}`), value, SQL_TTL);
}
