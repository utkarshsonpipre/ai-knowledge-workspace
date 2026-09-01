import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  // Semantic search needs the embedding provider, which AiModule owns.
  imports: [AiModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
