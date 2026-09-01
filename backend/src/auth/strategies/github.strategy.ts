import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

export interface GithubProfileData {
  githubId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.getOrThrow<string>('github.clientId'),
      clientSecret: config.getOrThrow<string>('github.clientSecret'),
      callbackURL: config.getOrThrow<string>('github.callbackUrl'),
      // `user:email` is needed because GitHub omits private emails from the profile.
      scope: ['user:email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const data: GithubProfileData = {
      githubId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      name: profile.displayName ?? profile.username ?? null,
      avatar: profile.photos?.[0]?.value ?? null,
    };
    return this.authService.validateGithubUser(data);
  }
}
