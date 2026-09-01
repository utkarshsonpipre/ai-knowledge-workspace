import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

export interface DashboardStats {
  totalDocuments: number;
  aiRequests: number;
  totalFiles: number;
  storageBytes: number;
  recentDocuments: Array<{ id: string; title: string; icon: string | null; updatedAt: Date }>;
  recentFiles: Array<{
    id: string;
    filename: string;
    type: string;
    size: number;
    status: string;
    createdAt: Date;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    input: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        preferences: true,
        createdAt: true,
      },
    });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.preferences !== undefined
          ? { preferences: dto.preferences as Prisma.InputJsonValue }
          : {}),
      },
      select: { id: true, email: true, name: true, avatar: true, preferences: true },
    });
  }

  /**
   * Everything the dashboard needs in one round trip — six small indexed
   * queries in a single transaction beat six sequential HTTP calls from the SPA.
   */
  async dashboard(userId: string): Promise<DashboardStats> {
    const [totalDocuments, aiRequests, fileAggregate, recentDocuments, recentFiles, recentActivity] =
      await this.prisma.$transaction([
        this.prisma.document.count({ where: { userId, isArchived: false } }),
        this.prisma.aIRequest.count({ where: { userId } }),
        this.prisma.file.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { size: true },
        }),
        this.prisma.document.findMany({
          where: { userId, isArchived: false },
          select: { id: true, title: true, icon: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        this.prisma.file.findMany({
          where: { userId },
          select: {
            id: true,
            filename: true,
            type: true,
            size: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.aIRequest.findMany({
          where: { userId },
          select: { id: true, type: true, status: true, input: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

    return {
      totalDocuments,
      aiRequests,
      totalFiles: fileAggregate._count._all,
      storageBytes: fileAggregate._sum.size ?? 0,
      recentDocuments,
      recentFiles,
      recentActivity: recentActivity.map((a) => ({
        ...a,
        input: a.input.slice(0, 140),
      })),
    };
  }
}
