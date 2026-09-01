/** Minimal shape of a Tiptap/ProseMirror JSON node. */
export interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
  'taskItem',
  'horizontalRule',
]);

/**
 * Flattens editor JSON to plain text for full-text search, chunking and AI
 * prompts. Kept dependency-free and total: unknown node types simply recurse.
 */
export function tiptapToPlainText(doc: unknown): string {
  const out: string[] = [];

  const walk = (node: TiptapNode): void => {
    if (typeof node.text === 'string') out.push(node.text);
    node.content?.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) out.push('\n');
  };

  if (doc && typeof doc === 'object') walk(doc as TiptapNode);

  return out
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Inverse used when AI generates raw text that must land in the editor. */
export function plainTextToTiptap(text: string): TiptapNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return {
    type: 'doc',
    content: paragraphs.length
      ? paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p.trim() }] }))
      : [{ type: 'paragraph' }],
  };
}
