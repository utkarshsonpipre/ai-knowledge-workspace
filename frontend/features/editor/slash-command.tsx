'use client';

import { Extension, type Range } from '@tiptap/core';
import { ReactRenderer, type Editor } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import tippy, { type Instance } from 'tippy.js';
import { cn } from '@/lib/utils';

export type AiSlashAction = 'summarize' | 'rewrite';

interface SlashItem {
  title: string;
  description: string;
  icon: React.ElementType;
  keywords: string;
  run: (props: { editor: Editor; range: Range; onAi: (action: AiSlashAction) => void }) => void;
}

const ITEMS: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: Type,
    keywords: 'paragraph text body',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section title',
    icon: Heading1,
    keywords: 'heading h1 title',
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section title',
    icon: Heading2,
    keywords: 'heading h2 subtitle',
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section title',
    icon: Heading3,
    keywords: 'heading h3',
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet list',
    description: 'Unordered list',
    icon: List,
    keywords: 'bullet unordered list ul',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'Ordered list',
    icon: ListOrdered,
    keywords: 'number ordered list ol',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'To-do',
    description: 'Checklist item',
    icon: CheckSquare,
    keywords: 'todo task checklist check',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Code block',
    description: 'Monospaced block',
    icon: Code2,
    keywords: 'code snippet pre',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Quote',
    description: 'Block quotation',
    icon: Quote,
    keywords: 'quote blockquote cite',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: Minus,
    keywords: 'divider hr rule separator',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Image',
    description: 'Embed by URL',
    icon: ImageIcon,
    keywords: 'image picture photo img',
    run: ({ editor, range }) => {
      const src = window.prompt('Image URL');
      const chain = editor.chain().focus().deleteRange(range);
      if (src) chain.setImage({ src }).run();
      else chain.run();
    },
  },
  {
    title: 'AI: summarize',
    description: 'Summarise this document',
    icon: Sparkles,
    keywords: 'ai summarize summary tldr',
    run: ({ editor, range, onAi }) => {
      editor.chain().focus().deleteRange(range).run();
      onAi('summarize');
    },
  },
  {
    title: 'AI: rewrite',
    description: 'Rewrite the document',
    icon: Wand2,
    keywords: 'ai rewrite improve polish',
    run: ({ editor, range, onAi }) => {
      editor.chain().focus().deleteRange(range).run();
      onAi('rewrite');
    },
  },
];

interface MenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export interface MenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SlashMenu = forwardRef<MenuRef, MenuProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((current) => (current + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected((current) => (current + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
        No matching block
      </div>
    );
  }

  return (
    <div className="max-h-72 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          onClick={() => command(item)}
          onMouseEnter={() => setSelected(index)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm',
            index === selected && 'bg-accent',
          )}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded border bg-background">
            <item.icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
});
SlashMenu.displayName = 'SlashMenu';

export interface SlashCommandOptions {
  onAi: (action: AiSlashAction) => void;
}

/**
 * Wraps @tiptap/suggestion rather than reimplementing caret tracking: the
 * extension already knows when `/` starts a query, how to filter, and how to
 * clean up the range when an item is picked.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { onAi: () => undefined };
  },

  addProseMirrorPlugins() {
    const onAi = this.options.onAi;

    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) =>
          ITEMS.filter((item) =>
            `${item.title} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()),
          ).slice(0, 10),
        command: ({ editor, range, props }) => props.run({ editor, range, onAi }),
        render: () => {
          let component: ReactRenderer<MenuRef, MenuProps> | null = null;
          let popup: Instance[] | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props) => {
              component?.updateProps({ items: props.items, command: props.command });
              popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
