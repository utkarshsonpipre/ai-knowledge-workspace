import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/jwt-payload';

/**
 * `@CurrentUser() user: AuthenticatedUser` — populated by JwtStrategy.validate.
 * Pass a key to project a single field: `@CurrentUser('id') userId: string`.
 */
export const CurrentUser = createParamDecorator(
  (key: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return key ? request.user?.[key] : request.user;
  },
);
