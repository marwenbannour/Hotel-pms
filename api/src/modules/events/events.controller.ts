import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable, of, takeUntil, timer } from 'rxjs';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { EventsService } from './events.service';

const HEARTBEAT_MS = 25_000;
const RECONNECT_MS = 3_000;

@ApiTags('Temps réel')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /**
   * Flux Server-Sent Events. `ready` à la connexion (l'écran recharge ce qu'il a pu manquer),
   * `change` à chaque modification, `ping` toutes les 25 s pour traverser les proxys.
   * Le flux se ferme à l'expiration du jeton d'accès : le client se reconnecte avec un jeton neuf,
   * ce qui revérifie la session (compte désactivé, droits modifiés).
   */
  @Sse()
  @ApiProduces('text/event-stream')
  @ApiOperation({ summary: 'Flux des modifications (SSE), filtré selon les droits du profil' })
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    const expiresInMs = Math.max(0, (user.tokenExpiresAt ?? 0) * 1000 - Date.now());
    return merge(
      of<MessageEvent>({ type: 'ready', data: { at: new Date().toISOString() }, retry: RECONNECT_MS }),
      this.events.streamFor(user).pipe(map((notice): MessageEvent => ({ type: 'change', data: notice }))),
      interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} }))),
    ).pipe(takeUntil(timer(expiresInMs)));
  }
}
