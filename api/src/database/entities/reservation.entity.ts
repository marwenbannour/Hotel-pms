import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn,
} from 'typeorm';
import { Guest } from './guest.entity';
import { Room } from './room.entity';
import { RoomType } from './room-type.entity';

export const BOARDS = ['room_only', 'half_board', 'full_board'] as const;
export type Board = (typeof BOARDS)[number];
export const CHANNELS = ['direct', 'phone', 'web', 'agency', 'ota'] as const;
export type Channel = (typeof CHANNELS)[number];
export const RESERVATION_STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
/** Statuts qui consomment du stock. */
export const ACTIVE_STATUSES: ReservationStatus[] = ['confirmed', 'checked_in'];

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() reference: string;
  @Column('uuid') guestId: string;
  @ManyToOne(() => Guest) @JoinColumn({ name: 'guest_id' }) guest?: Guest;
  @Column('uuid') roomTypeId: string;
  @ManyToOne(() => RoomType) @JoinColumn({ name: 'room_type_id' }) roomType?: RoomType;
  @Column({ type: 'uuid', nullable: true }) roomId: string | null;
  @ManyToOne(() => Room) @JoinColumn({ name: 'room_id' }) room?: Room | null;
  /** Dates au format YYYY-MM-DD ; la date de départ est exclue du séjour. */
  @Column({ type: 'date' }) arrivalDate: string;
  @Column({ type: 'date' }) departureDate: string;
  @Column() adults: number;
  @Column({ default: 0 }) children: number;
  @Column({ type: 'text' }) board: Board;
  @Column({ type: 'text' }) channel: Channel;
  @Column({ type: 'text', default: 'confirmed' }) status: ReservationStatus;
  @Column() totalAmount: number;
  @Column({ type: 'char', length: 3 }) currency: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'text', nullable: true }) cancelReason: string | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) checkedInAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) checkedOutAt: Date | null;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
