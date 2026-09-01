import { Injectable, NotFoundException } from '@nestjs/common';
import { File, FileStatus } from '@prisma/client';
import { Paginated, PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateUploadDto } from './dto/file.dto';
import { StorageService } from './storage.service';

export interface UploadTicket {
  fileId: string;
  path: string;
  signedUrl: string;
  token: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Step 1 of the upload handshake: reserve a row + a signed URL. The row acts
   * as the idempotency anchor — an abandoned upload just leaves a PENDING file.
   */
  async createUploadTicket(userId: string, dto: CreateUploadDto): Promise<UploadTicket> {
    const path = this.storage.buildPath(userId, dto.filename);
    const signed = await this.storage.createSignedUpload(path);

    const file = await this.prisma.file.create({
      data: {
        userId,
        filename: dto.filename,
        storagePath: path,
        type: dto.type,
        size: dto.size,
        status: FileStatus.UPLOADING,
      },
    });

    return { fileId: file.id, path, signedUrl: signed.signedUrl, token: signed.token };
  }

  /**
   * Step 2: the client confirms the direct upload finished; only then does the
   * processing job get queued.
   */
  async completeUpload(userId: string, fileId: string): Promise<File> {
    const file = await this.findOne(userId, fileId);

    const updated = await this.prisma.file.update({
      where: { id: file.id },
      data: { status: FileStatus.PENDING, url: file.storagePath },
    });

    await this.queue.enqueueFileProcessing({ fileId: file.id, userId });
    return updated;
  }

  async findAll(userId: string, { skip, take }: PaginationDto): Promise<Paginated<File>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.file.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOne(userId: string, id: string): Promise<File> {
    const file = await this.prisma.file.findFirst({ where: { id, userId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getDownloadUrl(userId: string, id: string): Promise<{ url: string }> {
    const file = await this.findOne(userId, id);
    return { url: await this.storage.createSignedDownloadUrl(file.storagePath) };
  }

  async remove(userId: string, id: string): Promise<void> {
    const file = await this.findOne(userId, id);
    await this.prisma.file.delete({ where: { id: file.id } });
    // Storage cleanup is best-effort: a missed object is cheap, a failed
    // request that leaves a dangling DB row is not.
    await this.storage.remove(file.storagePath);
  }
}
