'use client';

import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown';
const MAX_BYTES = 20 * 1024 * 1024;

export function UploadDropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mirrors the server's DTO limits so obvious rejects never leave the browser.
  const accept = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    const valid = files.filter((file) => {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 20 MB`);
        return false;
      }
      return true;
    });
    if (valid.length) onFiles(valid);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) accept(event.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
        dragging ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <UploadCloud className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">Drop files here or click to browse</p>
      <p className="text-xs text-muted-foreground">PDF, DOCX, TXT or Markdown · up to 20 MB</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
