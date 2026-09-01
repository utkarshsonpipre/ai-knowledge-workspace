import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';
import { TextExtractorService } from './text-extractor.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, StorageService, TextExtractorService],
  exports: [FilesService, StorageService, TextExtractorService],
})
export class FilesModule {}
