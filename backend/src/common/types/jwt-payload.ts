export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string | null;
  /** Refresh-token id — present only on refresh tokens, enables rotation lookup. */
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
