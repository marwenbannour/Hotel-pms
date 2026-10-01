import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

@Entity('room_types')
export class RoomType {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() code: string;
  @Column() name: string;
  @Column() capacity: number;
  /** Tarif de base par nuit, en unités mineures. */
  @Column() basePrice: number;
  @Column({ type: 'char', length: 3 }) currency: string;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
