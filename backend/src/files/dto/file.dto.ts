import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_FILE_BYTES, SUPPORTED_MIME_TYPES } from '../text-extractor.service';

export class CreateUploadDto {
  @IsString()
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsIn(Object.keys(SUPPORTED_MIME_TYPES), {
    message: `type must be one of: ${Object.keys(SUPPORTED_MIME_TYPES).join(', ')}`,
  })
  type: string;

  // Size is validated up front so an oversized file is rejected before a signed
  // URL is ever minted, rather than after 20MB have crossed the wire.
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_BYTES)
  size: number;
}
