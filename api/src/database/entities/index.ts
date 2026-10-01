import { AuditLog } from './audit-log.entity';
import { Guest } from './guest.entity';
import { IdempotencyRecord } from './idempotency-record.entity';
import { NavigationItem } from './navigation-item.entity';
import { RefreshToken } from './refresh-token.entity';
import { Reservation } from './reservation.entity';
import { Room } from './room.entity';
import { RoomType } from './room-type.entity';
import { User } from './user.entity';

export { AuditLog, Guest, IdempotencyRecord, NavigationItem, RefreshToken, Reservation, Room, RoomType, User };
export const ENTITIES = [AuditLog, Guest, IdempotencyRecord, NavigationItem, RefreshToken, Reservation, Room, RoomType, User];
