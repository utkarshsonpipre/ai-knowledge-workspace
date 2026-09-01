import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../common/types/jwt-payload';
import { JobProgressEvent } from '../queue/queue.types';

export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Same JWT as the REST API, presented in the handshake. Sockets are single-user
 * rooms, so a client can only ever receive progress for its own jobs — the
 * worker emits to `user:<id>` and never broadcasts.
 */
@WebSocketGateway({
  cors: {
    // Resolved per handshake, not at import time: decorators are evaluated
    // before ConfigModule has loaded the .env file into process.env.
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) =>
      callback(null, !origin || origin === (process.env.FRONTEND_URL ?? 'http://localhost:3000')),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace(/^Bearer /, '');

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
      client.emit('connected', { userId: payload.sub });
      // Logged as a pair with the disconnect below, so a reconnect loop is
      // distinguishable from a single expected teardown.
      this.logger.debug(`Socket connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.debug('Rejected socket with invalid token');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  emitProgress(userId: string, event: JobProgressEvent): void {
    this.server?.to(userRoom(userId)).emit('job:progress', event);
  }

  /** Fired when a job mutates data the client is likely showing. */
  emitResourceUpdated(userId: string, resource: 'file' | 'document' | 'ai', id: string): void {
    this.server?.to(userRoom(userId)).emit('resource:updated', { resource, id });
  }
}
