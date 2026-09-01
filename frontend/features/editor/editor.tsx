'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUpdateDocument } from '@/hooks/use-documents';
import type { DocumentDetail } from '@/lib/types';
import { SlashCommand, type AiSlashAction } from './slash-command';
import 'tippy.js/dist/tippy.css';

const AUTOSAVE_MS = 900;

interface EditorProps {
  document: DocumentDetail;
  onAiAction: (action: AiSlashAction) => void;
}

export function DocumentEditor({ document: doc, onAiAction }: EditorProps) {
  const update = useUpdateDocument(doc.id);
  const [title, setTitle] = useState(doc.title);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (payload: { title?: string; content?: JSONContent }) => {
      setSaved('saving');
      update.mutate(payload as Parameters<typeof update.mutate>[0], {
        onSuccess: () => setSaved('saved'),
        onError: () => setSaved('idle'),
      });
    },
    [update],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Type '/' for commands…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
      SlashCommand.configure({ onAi: onAiAction }),
    ],
    content: doc.content as JSONContent,
    editorProps: {
      attributes: { class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none' },
    },
    // Debounced autosave: one write per pause in typing, not per keystroke.
    onUpdate: ({ editor: instance }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save({ content: instance.getJSON() }), AUTOSAVE_MS);
    },
  });

  // Replace content when navigating between documents without remounting.
  useEffect(() => {
    setTitle(doc.title);
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(doc.content as JSONContent, false);
    }
  }, [doc.id, doc.title, doc.content, editor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        save({ title, content: editor?.getJSON() });
        toast.success('Saved');
      }
      // Ctrl+/ opens the same menu as typing "/".
      if (mod && event.key === '/') {
        event.preventDefault();
        editor?.chain().focus().insertContent('/').run();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, save, title]);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'All changes saved' : ' '}
        </span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl S
        </kbd>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => title !== doc.title && save({ title })}
        placeholder="Untitled"
        className="w-full border-none bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
      />

      <div className="mt-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
