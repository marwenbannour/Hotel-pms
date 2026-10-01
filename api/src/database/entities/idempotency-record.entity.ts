import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyRecord {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn() key: string;
  @Column() route: string;
  @Column() requestHash: string;
  @Column({ type: 'text' }) state: 'processing' | 'completed';
  @Column({ type: 'int', nullable: true }) responseStatus: number | null;
  @Column({ type: 'jsonb', nullable: true }) responseBody: unknown;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
