import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateUploadDto } from './dto/file.dto';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createUploadUrl(@CurrentUser('id') userId: string, @Body() dto: CreateUploadDto) {
    return this.files.createUploadTicket(userId, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.files.completeUpload(userId, id);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    return this.files.findAll(userId, pagination);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.files.findOne(userId, id);
  }

  @Get(':id/download-url')
  download(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.files.getDownloadUrl(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.files.remove(userId, id);
  }
}
