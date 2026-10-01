import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { RoomType } from './room-type.entity';

export const ROOM_STATUSES = ['available', 'occupied', 'cleaning', 'maintenance'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() number: string;
  @Column({ type: 'int', nullable: true }) floor: number | null;
  @Column('uuid') roomTypeId: string;
  @ManyToOne(() => RoomType) @JoinColumn({ name: 'room_type_id' }) roomType?: RoomType;
  @Column({ type: 'text', default: 'available' }) status: RoomStatus;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
