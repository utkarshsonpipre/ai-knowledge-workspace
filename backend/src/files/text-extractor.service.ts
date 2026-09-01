import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  /**
   * Normalises PDF/DOCX/TXT/MD down to plain text. Everything downstream
   * (chunking, embedding, FTS, AI prompts) only ever sees this string.
   */
  async extract(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const kind = SUPPORTED_MIME_TYPES[mimeType] ?? extensionOf(filename);

    switch (kind) {
      case 'pdf': {
        const parsed = await pdfParse(buffer);
        return normalise(parsed.text);
      }
      case 'docx': {
        const { value, messages } = await mammoth.extractRawText({ buffer });
        if (messages.length) this.logger.debug(`mammoth: ${messages.length} conversion notes`);
        return normalise(value);
      }
      case 'txt':
      case 'md':
        return normalise(buffer.toString('utf8'));
      default:
        throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }
  }
}

function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/** PDFs in particular arrive with ragged whitespace that wrecks chunk boundaries. */
function normalise(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
