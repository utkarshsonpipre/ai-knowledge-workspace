import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 20;

  @IsOptional()
  @IsString()
  q?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}
