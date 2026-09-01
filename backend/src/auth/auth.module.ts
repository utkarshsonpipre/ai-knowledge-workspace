import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    // Secrets are passed per-sign call so access and refresh tokens can use
    // separate keys; a leaked access secret must not mint refresh tokens.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, GithubStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
