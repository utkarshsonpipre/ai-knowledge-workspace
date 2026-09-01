import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, hashToken } from './auth.service';

const CONFIG: Record<string, string> = {
  'jwt.secret': 'unit-test-access-secret-value-0123456789',
  'jwt.refreshSecret': 'unit-test-refresh-secret-value-0123456789',
  'jwt.accessTtl': '15m',
  'jwt.refreshTtl': '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { upsert: jest.Mock; findUnique: jest.Mock };
    refreshToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { upsert: jest.fn(), findUnique: jest.fn() },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt_1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (k: string, d?: string) => CONFIG[k] ?? d, getOrThrow: (k: string) => CONFIG[k] } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('issues an access/refresh pair and persists only the hash', async () => {
    const pair = await service.issueTokens({ id: 'user_1', email: 'a@b.c' });

    expect(pair.accessToken).toEqual(expect.any(String));
    expect(pair.refreshToken).toEqual(expect.any(String));

    const stored = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(hashToken(pair.refreshToken));
    // The raw token must never hit the database.
    expect(JSON.stringify(stored)).not.toContain(pair.refreshToken);
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rotates a valid refresh token and revokes the old one', async () => {
    const { refreshToken } = await service.issueTokens({ id: 'user_1', email: 'a@b.c' });

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: 'user_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'a@b.c',
      name: null,
      avatar: null,
    });

    const rotated = await service.rotateRefreshToken(refreshToken);

    expect(rotated.refreshToken).not.toBe(refreshToken);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt_1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('kills every session when an already-used refresh token is replayed', async () => {
    const { refreshToken } = await service.issueTokens({ id: 'user_1', email: 'a@b.c' });

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: 'user_1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects a refresh token signed with the access secret', async () => {
    const jwt = new JwtService();
    const forged = await jwt.signAsync({ sub: 'user_1' }, { secret: CONFIG['jwt.secret'] });

    await expect(service.rotateRefreshToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });
});
