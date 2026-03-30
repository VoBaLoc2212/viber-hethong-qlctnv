const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 180;

export function chunkText(input: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP): string[] {
  const text = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .trim();
  if (!text) {
    return [];
  }

  const safeChunkSize = Math.max(300, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeChunkSize / 2)));

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let end = Math.min(cursor + safeChunkSize, text.length);

    if (end < text.length) {
      const nextBoundary = text.lastIndexOf(" ", end);
      if (nextBoundary > cursor + Math.floor(safeChunkSize * 0.6)) {
        end = nextBoundary;
      }
    }

    const chunk = text.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    cursor = Math.max(end - safeOverlap, cursor + 1);
  }

  return chunks;
}
