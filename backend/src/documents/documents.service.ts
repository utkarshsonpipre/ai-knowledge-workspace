import { Injectable, NotFoundException } from '@nestjs/common';
import { Document, Prisma } from '@prisma/client';
import { Paginated, PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { tiptapToPlainText } from './tiptap.util';

const EMPTY_DOC = { type: 'doc', content: [] };

/** Columns returned in list views — never ships `content` over the wire. */
const LIST_SELECT = {
  id: true,
  title: true,
  icon: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  summary: true,
} satisfies Prisma.DocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async create(userId: string, dto: CreateDocumentDto): Promise<Document> {
    const content = (dto.content ?? EMPTY_DOC) as Prisma.InputJsonValue;

    return this.prisma.document.create({
      data: {
        userId,
        title: dto.title?.trim() || 'Untitled',
        icon: dto.icon,
        content,
        plainText: tiptapToPlainText(content),
      },
    });
  }

  async findAll(
    userId: string,
    { skip, take, q }: PaginationDto,
    includeArchived = false,
  ): Promise<Paginated<Prisma.DocumentGetPayload<{ select: typeof LIST_SELECT }>>> {
    const where: Prisma.DocumentWhereInput = {
      userId,
      ...(includeArchived ? {} : { isArchived: false }),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async findOne(userId: string, id: string): Promise<Document> {
    const doc = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto): Promise<Document> {
    await this.assertOwned(userId, id);

    const data: Prisma.DocumentUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title.trim() || 'Untitled' } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
    };

    if (dto.content !== undefined) {
      data.content = dto.content as Prisma.InputJsonValue;
      data.plainText = tiptapToPlainText(dto.content);
    }

    const updated = await this.prisma.document.update({ where: { id }, data });

    // Only body changes invalidate the vector index; renames do not.
    if (dto.content !== undefined) {
      await this.queue.enqueueIndexing({ documentId: id, userId });
    }

    return updated;
  }

  async rename(userId: string, id: string, title: string): Promise<Document> {
    await this.assertOwned(userId, id);
    return this.prisma.document.update({
      where: { id },
      data: { title: title.trim() || 'Untitled' },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    // Chunks cascade at the DB level, so the vector index cleans itself up.
    await this.prisma.document.delete({ where: { id } });
  }

  async recent(userId: string, take = 5) {
    return this.prisma.document.findMany({
      where: { userId, isArchived: false },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  /** Cheap existence+ownership probe used before any mutation. */
  private async assertOwned(userId: string, id: string): Promise<void> {
    const found = await this.prisma.document.findFirst({ where: { id, userId }, select: { id: true } });
    if (!found) throw new NotFoundException('Document not found');
  }
}
