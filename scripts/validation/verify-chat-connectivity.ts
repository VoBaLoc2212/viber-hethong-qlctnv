import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFromFile() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore if .env is missing in this environment
  }
}

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function toText(content: string | Array<{ text?: string }> | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content.trim();
  return content.map((part) => part.text ?? "").join("\n").trim();
}

function resolveChatEndpoint(): string {
  const raw = process.env.AI_CHAT_ENDPOINT?.trim() || process.env.AI_CHAT_BASE_URL?.trim();
  if (!raw) {
    throw new Error("Missing AI_CHAT_ENDPOINT (or AI_CHAT_BASE_URL) in environment or .env file");
  }

  const normalized = raw.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

async function main() {
  loadEnvFromFile();

  const endpoint = resolveChatEndpoint();
  const apiKey = process.env.AI_CHAT_API_KEY?.trim();
  const model = process.env.AI_CHAT_MODEL?.trim();
  const temperature = Number(process.env.AI_TEMPERATURE ?? 0.1);
  if (!apiKey) {
    throw new Error("Missing AI_CHAT_API_KEY in environment or .env file");
  }
  if (!model) {
    throw new Error("Missing AI_CHAT_MODEL in environment or .env file");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: Number.isFinite(temperature) ? temperature : 0.1,
      messages: [
        {
          role: "user",
          content: "Trả lời đúng một từ: PONG",
        },
      ],
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as OpenAiChatResponse;

  if (!response.ok) {
    throw new Error(`Chat API error ${response.status}: ${payload?.error?.message ?? "unknown"}`);
  }

  const text = toText(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("Chat endpoint returned empty content");
  }

  const result = {
    ok: true,
    endpoint,
    model,
    sampleResponse: text.slice(0, 200),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
