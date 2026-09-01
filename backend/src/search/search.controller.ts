import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

class SearchQueryDto {
  @IsString()
  @MaxLength(500)
  q: string;

  @IsOptional()
  @IsIn(['keyword', 'semantic', 'all'])
  mode: 'keyword' | 'semantic' | 'all' = 'all';
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async run(@CurrentUser('id') userId: string, @Query() dto: SearchQueryDto) {
    switch (dto.mode) {
      case 'keyword':
        return { query: dto.q, keyword: await this.search.keyword(userId, dto.q), semantic: [] };
      case 'semantic':
        return { query: dto.q, keyword: [], semantic: await this.search.semantic(userId, dto.q) };
      default:
        return this.search.combined(userId, dto.q);
    }
  }
}
