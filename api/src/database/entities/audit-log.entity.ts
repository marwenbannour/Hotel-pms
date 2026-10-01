import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Journal d'audit des opérations critiques (section 4.3), en ajout seul. */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) actorId: string | null;
  @Column() action: string;
  @Column() entityType: string;
  @Column({ type: 'uuid', nullable: true }) entityId: string | null;
  @Column({ type: 'jsonb', default: {} }) data: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
