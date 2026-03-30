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

async function main() {
  loadEnvFromFile();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  const GEMINI_MODEL = process.env.GEMINI_MODEL_CHAT?.trim() || "gemini-2.5-flash";

  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment or .env file");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0.1 },
      contents: [
        {
          role: "user",
          parts: [{ text: "Trả lời đúng một từ: PONG" }],
        },
      ],
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${payload?.error?.message ?? "unknown"}`);
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("Gemini returned empty content");
  }

  const result = {
    ok: true,
    model: GEMINI_MODEL,
    sampleResponse: text.slice(0, 200),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
