import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** Tiptap document JSON. */
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class RenameDocumentDto {
  @IsString()
  @MaxLength(200)
  title: string;
}
