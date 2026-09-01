import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Render's health check target — verifies the DB round-trips, not just that Node is up. */
  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }
}
