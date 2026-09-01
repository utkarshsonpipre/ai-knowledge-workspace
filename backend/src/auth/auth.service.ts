import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuthenticatedUser, JwtPayload, TokenPair } from '../common/types/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { GithubProfileData } from './strategies/github.strategy';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Upsert on githubId: first login creates the account, later logins refresh profile data. */
  async validateGithubUser(profile: GithubProfileData): Promise<User> {
    return this.prisma.user.upsert({
      where: { githubId: profile.githubId },
      create: {
        githubId: profile.githubId,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      },
      update: {
        // Email is unique; only overwrite when GitHub actually gave us one.
        ...(profile.email ? { email: profile.email } : {}),
        name: profile.name,
        avatar: profile.avatar,
      },
    });
  }

  async issueTokens(user: Pick<User, 'id' | 'email'>, meta: SessionMeta = {}): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.secret'),
      expiresIn: ttl(this.config.get<string>('jwt.accessTtl', '15m')),
    });

    // `jti` is what makes each refresh token unique. Without it two tokens
    // minted for the same user inside the same second are byte-identical, which
    // collides on the tokenHash unique index and hands back a token that was
    // just revoked by rotation.
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: ttl(this.config.get<string>('jwt.refreshTtl', '7d')),
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: this.expiryOf(refreshToken),
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Rotating refresh: each token is single-use. Presenting an already-revoked
   * token means it leaked and was replayed, so every session for that user is
   * killed rather than just this one.
   */
  async rotateRefreshToken(
    rawToken: string,
    meta: SessionMeta = {},
  ): Promise<TokenPair & { user: AuthenticatedUser }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });

    if (!stored) throw new UnauthorizedException('Refresh token not recognised');

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token already used');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');

    const pair = await this.issueTokens(user, meta);

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedById: hashToken(pair.refreshToken),
      },
    });

    return {
      ...pair,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    };
  }

  /** Idempotent: logging out with an unknown or already-revoked token is a no-op. */
  async revokeRefreshToken(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true },
    });
    return user;
  }

  /** Reads `exp` off the freshly-signed token so TTL config has exactly one source. */
  private expiryOf(token: string): Date {
    const decoded = this.jwt.decode(token) as JwtPayload | null;
    if (!decoded?.exp) throw new Error('Signed token is missing an exp claim');
    return new Date(decoded.exp * 1000);
  }
}

/**
 * Refresh tokens are already 256+ bits of signed entropy, so a plain SHA-256
 * is enough to keep DB dumps useless — bcrypt would only add latency.
 */
/** jsonwebtoken types `expiresIn` as a branded ms string; config gives a plain one. */
function ttl(value: string): JwtSignOptions['expiresIn'] {
  return value as JwtSignOptions['expiresIn'];
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
