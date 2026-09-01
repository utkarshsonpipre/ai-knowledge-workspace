export interface TextChunk {
  content: string;
  index: number;
  /** Rough token estimate (~4 chars/token) — enough to budget a prompt. */
  tokenCount: number;
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

/**
 * Paragraph-aware sliding window. Splitting on blank lines first keeps
 * semantically whole ideas together; the character overlap stops an answer
 * that straddles a boundary from being lost by both neighbours.
 *
 * ~1200 chars ≈ 300 tokens, comfortably inside MiniLM's 256-token window for
 * the common case while keeping the chunk count (and embedding cost) sane.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = options.overlapChars ?? 200;

  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const blocks = cleaned.split(/\n{2,}/).flatMap((block) => splitOversized(block, maxChars));

  const chunks: TextChunk[] = [];
  let buffer = '';

  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({ content, index: chunks.length, tokenCount: Math.ceil(content.length / 4) });
    buffer = overlapChars > 0 ? content.slice(-overlapChars) : '';
  };

  for (const block of blocks) {
    if (buffer && buffer.length + block.length + 2 > maxChars) flush();
    buffer = buffer ? `${buffer}\n\n${block}` : block;
  }
  flush();

  return chunks;
}

/** A single paragraph longer than the window is cut on sentence boundaries. */
function splitOversized(block: string, maxChars: number): string[] {
  if (block.length <= maxChars) return [block];

  const sentences = block.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) ?? [block];
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current) {
      parts.push(current.trim());
      current = '';
    }
    // A single sentence beyond the window (tables, minified text) is hard-cut.
    if (sentence.length > maxChars) {
      for (let i = 0; i < sentence.length; i += maxChars) {
        parts.push(sentence.slice(i, i + maxChars).trim());
      }
      continue;
    }
    current += sentence;
  }

  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}
