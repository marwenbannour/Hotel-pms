import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

export const GUEST_SEGMENTS = ['individual', 'group', 'company'] as const;
export type GuestSegment = (typeof GUEST_SEGMENTS)[number];

@Entity('guests')
export class Guest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() firstName: string;
  @Column() lastName: string;
  @Column({ type: 'text', nullable: true }) email: string | null;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ type: 'char', length: 2, nullable: true }) nationality: string | null;
  @Column({ type: 'text', default: 'individual' }) segment: GuestSegment;
  @Column({ type: 'jsonb', default: {} }) preferences: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) erasedAt: Date | null;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
