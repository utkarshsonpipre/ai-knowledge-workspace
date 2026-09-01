import { AIRequestType } from '@prisma/client';

export interface ProcessFileJob {
  fileId: string;
  userId: string;
}

export interface IndexDocumentJob {
  documentId: string;
  userId: string;
}

export interface RunAiJob {
  aiRequestId: string;
  userId: string;
  type: AIRequestType;
  documentId?: string;
  /** Free-form per-type payload: rewrite mode, chat history, top-k, ... */
  options?: Record<string, unknown>;
}

/** Stages emitted over Socket.IO so the client can show a real progress bar. */
export type JobStage =
  | 'queued'
  | 'uploading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'generating'
  | 'completed'
  | 'failed';

export interface JobProgressEvent {
  jobId: string;
  /** File id or AI request id, depending on `resource`. */
  resourceId: string;
  resource: 'file' | 'ai' | 'document';
  stage: JobStage;
  percent: number;
  message?: string;
  error?: string;
}
