import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/jwt-payload';
import { AuthService, SessionMeta } from './auth.service';
import { GithubAuthGuard } from './guards/github-auth.guard';

export const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Entry point — Passport redirects to GitHub's consent screen. */
  @Public()
  @Get('github')
  @UseGuards(GithubAuthGuard)
  login(): void {
    /* handled by the guard */
  }

  /**
   * The access token is deliberately NOT put in the redirect URL (it would leak
   * into browser history, Referer headers and server logs). Only the httpOnly
   * refresh cookie is set; the SPA exchanges it for an access token on load.
   */
  @Public()
  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const user = req.user as { id: string; email: string | null };
    const { refreshToken } = await this.authService.issueTokens(user, metaOf(req));

    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    res.redirect(`${this.config.get<string>('frontendUrl')}/auth/callback`);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Missing refresh token');

    const { accessToken, refreshToken, user } = await this.authService.rotateRefreshToken(
      token,
      metaOf(req),
    );
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());

    return { accessToken, user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private cookieOptions(): CookieOptions {
    const secure = this.config.get<boolean>('cookie.secure') ?? false;
    return {
      httpOnly: true,
      secure,
      // Vercel frontend + Render backend are cross-site in production, which
      // requires SameSite=None; localhost:3000 -> :4000 is same-site, so Lax
      // works in dev without demanding HTTPS.
      sameSite: secure ? 'none' : 'lax',
      domain: this.config.get<string>('cookie.domain'),
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }
}

function metaOf(req: Request): SessionMeta {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}
