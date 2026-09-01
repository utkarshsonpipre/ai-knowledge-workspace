import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, RenameDocumentDto, UpdateDocumentDto } from './dto/document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDocumentDto) {
    return this.documents.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query() pagination: PaginationDto,
    @Query('archived') archived?: string,
  ) {
    return this.documents.findAll(userId, pagination, archived === 'true');
  }

  @Get('recent')
  recent(@CurrentUser('id') userId: string) {
    return this.documents.recent(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.documents.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(userId, id, dto);
  }

  @Patch(':id/rename')
  rename(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RenameDocumentDto,
  ) {
    return this.documents.rename(userId, id, dto.title);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.documents.remove(userId, id);
  }
}
