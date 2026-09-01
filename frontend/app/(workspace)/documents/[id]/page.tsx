'use client';

import { Loader2, PanelRightOpen } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AiPanel, type AiPanelTab } from '@/features/ai/ai-panel';
import { DocumentEditor } from '@/features/editor/editor';
import { useDocument } from '@/hooks/use-documents';
import { useUiStore } from '@/store/ui-store';

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: document, isLoading, error } = useDocument(id);
  const [tab, setTab] = useState<AiPanelTab>('summarize');
  const panelOpen = useUiStore((s) => s.aiPanelOpen);
  const setPanelOpen = useUiStore((s) => s.setAiPanelOpen);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return <p className="p-8 text-sm text-muted-foreground">This document could not be loaded.</p>;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1 overflow-y-auto">
        {!panelOpen && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-4 z-10 hidden lg:flex"
            onClick={() => setPanelOpen(true)}
            aria-label="Open AI panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}

        <DocumentEditor
          document={document}
          onAiAction={(action) => {
            setPanelOpen(true);
            setTab(action);
          }}
        />
      </div>

      <AiPanel
        documentId={document.id}
        documentText={document.plainText}
        tab={tab}
        onTabChange={setTab}
      />
    </div>
  );
}
