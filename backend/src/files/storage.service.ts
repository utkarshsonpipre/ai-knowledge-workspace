import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export interface SignedUpload {
  path: string;
  signedUrl: string;
  token: string;
}

/**
 * Supabase Storage wrapper. Bytes never pass through this API server: the
 * client PUTs straight to Supabase using a short-lived signed URL, so uploads
 * are not bounded by our request timeout or Render's memory.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('supabase.bucket', 'knowledge-files');
  }

  onModuleInit(): void {
    const url = this.config.get<string>('supabase.url');
    const key = this.config.get<string>('supabase.serviceKey');

    if (!url || !key) {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_KEY unset — uploads are disabled');
      return;
    }

    // Service-role key: server-side only, bypasses RLS. Never expose to the client.
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  /** `userId/uuid.ext` keeps every object namespaced to its owner. */
  buildPath(userId: string, filename: string): string {
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
    return `${userId}/${randomUUID()}.${ext}`;
  }

  async createSignedUpload(path: string): Promise<SignedUpload> {
    const { data, error } = await this.storage().createSignedUploadUrl(path);
    if (error || !data) {
      throw new InternalServerErrorException(`Could not create upload URL: ${error?.message}`);
    }
    return { path: data.path, signedUrl: data.signedUrl, token: data.token };
  }

  /** Time-boxed read URL handed to the browser for previews/downloads. */
  async createSignedDownloadUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.storage().createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      throw new InternalServerErrorException(`Could not sign download URL: ${error?.message}`);
    }
    return data.signedUrl;
  }

  /** Used by the worker to pull bytes for text extraction. */
  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.storage().download(path);
    if (error || !data) {
      throw new InternalServerErrorException(`Could not download ${path}: ${error?.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.storage().remove([path]);
    if (error) this.logger.warn(`Failed to delete ${path}: ${error.message}`);
  }

  private storage() {
    if (!this.client) {
      throw new InternalServerErrorException('Storage is not configured');
    }
    return this.client.storage.from(this.bucket);
  }
}
