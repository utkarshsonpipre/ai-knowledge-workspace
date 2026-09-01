import { RewriteMode } from './interfaces/ai-provider.interface';

// NOTE: the literal word "JSON" must stay in this prompt. Both Groq and OpenAI
// reject `response_format: json_object` with a 400 unless it appears somewhere
// in the messages.
export const SUMMARY_SYSTEM_PROMPT = `You are a precise document analyst.
Return ONLY valid JSON matching this shape:
{"summary": string, "keyPoints": string[], "actionItems": string[]}

Rules:
- "summary": 2-4 sentences capturing the document's purpose and conclusion.
- "keyPoints": 3-7 short factual bullets, each under 140 characters.
- "actionItems": concrete next steps explicitly implied by the text. Empty array if none.
- Never invent facts that are not in the source text.`;

const REWRITE_INSTRUCTIONS: Record<RewriteMode, string> = {
  improve: 'Improve clarity, flow and word choice while preserving meaning and length.',
  professional: 'Rewrite in a polished, professional business register. No slang, no filler.',
  shorter: 'Compress to roughly half the length. Keep every fact; drop redundancy.',
  longer: 'Expand with relevant detail, examples and transitions. Do not invent facts.',
  simplify: 'Rewrite so a non-expert understands it. Short sentences, plain words.',
};

export function rewritePrompt(content: string, mode: RewriteMode): string {
  return `${REWRITE_INSTRUCTIONS[mode]}

Return ONLY the rewritten text — no preamble, no explanation, no markdown fences.

---
${content}`;
}

export const GENERATE_SYSTEM_PROMPT = `You are a writing assistant inside a knowledge workspace.
Produce well-structured Markdown with clear headings and concise paragraphs.
Return only the document body — no meta commentary.`;

/**
 * Grounding rules matter more than the retrieved text itself: without the
 * "say you don't know" clause the model happily answers from parametric memory
 * and the citations become decorative.
 */
export function ragSystemPrompt(context: string): string {
  return `You answer questions using ONLY the user's own documents provided below.

Rules:
- If the context does not contain the answer, say so plainly. Do not guess.
- Cite the sources you used as [1], [2], ... matching the numbered excerpts.
- Be concise and specific.

CONTEXT
${context}`;
}
