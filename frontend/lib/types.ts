export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  preferences?: Record<string, unknown>;
  createdAt?: string;
}

export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export interface DocumentListItem {
  id: string;
  title: string;
  icon: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  summary: DocumentSummary | null;
}

export interface DocumentDetail extends DocumentListItem {
  content: Record<string, unknown>;
  plainText: string;
  userId: string;
}

export type FileStatus = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface StoredFile {
  id: string;
  filename: string;
  type: string;
  size: number;
  status: FileStatus;
  error: string | null;
  documentId: string | null;
  createdAt: string;
  processedAt: string | null;
}

export type AIRequestType = 'SUMMARIZE' | 'REWRITE' | 'GENERATE' | 'CHAT';
export type AIRequestStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AIRequest {
  id: string;
  type: AIRequestType;
  status: AIRequestStatus;
  input: string;
  output: string | null;
  result: unknown;
  error: string | null;
  documentId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface DashboardStats {
  totalDocuments: number;
  aiRequests: number;
  totalFiles: number;
  storageBytes: number;
  recentDocuments: Array<{ id: string; title: string; icon: string | null; updatedAt: string }>;
  recentFiles: Array<{
    id: string;
    filename: string;
    type: string;
    size: number;
    status: FileStatus;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: AIRequestType;
    status: AIRequestStatus;
    input: string;
    createdAt: string;
  }>;
}

export interface KeywordHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  rank: number;
  updatedAt: string;
}

export interface SemanticHit {
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
}

export interface SearchResults {
  query: string;
  keyword: KeywordHit[];
  semantic: SemanticHit[];
}

export interface AskSource {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  similarity: number;
  excerpt: string;
}

export type RewriteMode = 'improve' | 'professional' | 'shorter' | 'longer' | 'simplify';

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
  resourceId: string;
  resource: 'file' | 'ai' | 'document';
  stage: JobStage;
  percent: number;
  message?: string;
  error?: string;
}
