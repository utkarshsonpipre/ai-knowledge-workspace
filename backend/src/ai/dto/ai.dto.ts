import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ChatRole, RewriteMode } from '../interfaces/ai-provider.interface';

export const REWRITE_MODES: RewriteMode[] = [
  'improve',
  'professional',
  'shorter',
  'longer',
  'simplify',
];

export class SummarizeDto {
  /** Either summarise a stored document... */
  @IsOptional()
  @IsString()
  documentId?: string;

  /** ...or an arbitrary selection from the editor. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;
}

export class RewriteDto {
  @IsString()
  @MaxLength(100_000)
  content: string;

  @IsIn(REWRITE_MODES)
  mode: RewriteMode;

  @IsOptional()
  @IsString()
  documentId?: string;
}

export class GenerateDto {
  @IsString()
  @MaxLength(4_000)
  prompt: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: Exclude<ChatRole, 'system'>;

  @IsString()
  @MaxLength(10_000)
  content: string;
}

export class AskDto {
  @IsString()
  @MaxLength(2_000)
  question: string;

  /** Scope retrieval to one document; omit to search the whole workspace. */
  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK = 6;
}
