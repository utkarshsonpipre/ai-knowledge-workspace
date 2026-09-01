import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** Free-form UI settings (theme, default rewrite mode, sidebar state, ...). */
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
