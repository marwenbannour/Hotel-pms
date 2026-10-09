import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import { AuthUser } from '../../common/auth.decorators';
import { Permission } from '../../common/permissions';

/** Familles de données qu'un écran peut avoir à recharger. */
export const TOPICS = ['rooms', 'reservations', 'billing', 'guests'] as const;
export type Topic = (typeof TOPICS)[number];

const TOPIC_PERMISSION: Record<Topic, Permission> = {
  rooms: 'rooms:read',
  reservations: 'reservations:read',
  billing: 'billing:read',
  guests: 'guests:read',
};

export interface Change {
  /** Le premier sujet est celui de la ressource identifiée par `id`. */
  topics: Topic[];
  id?: string;
}

/** Ce que reçoit un abonné : uniquement les sujets qu'il a le droit de lire. */
export interface ChangeNotice {
  topics: Topic[];
  id?: string;
  at: string;
}

/**
 * Bus des changements, en mémoire : une seule instance de l'API. En multi-instances,
 * le remplacer par PostgreSQL LISTEN/NOTIFY sans changer les émetteurs ni les abonnés.
 */
@Injectable()
export class EventsService {
  private readonly changes = new Subject<Change>();

  publish(change: Change) {
    this.changes.next(change);
  }

  /**
   * Chaque changement est signalé à tous les abonnés, car le tableau de bord de chacun en dépend
   * (une réservation du jour change les priorités du ménage), mais sans les sujets ni l'identifiant
   * qu'ils n'ont pas le droit de lire.
   */
  streamFor(user: AuthUser): Observable<ChangeNotice> {
    const readable = (t: Topic) => user.permissions.includes(TOPIC_PERMISSION[t]);
    return this.changes.pipe(
      filter(() => user.permissions.length > 0),
      map((c) => {
        const notice: ChangeNotice = { topics: c.topics.filter(readable), at: new Date().toISOString() };
        if (c.id && readable(c.topics[0])) notice.id = c.id;
        return notice;
      }),
    );
  }
}
