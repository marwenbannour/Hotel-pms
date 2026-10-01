import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Lang } from '../../common/i18n';
import type { Role } from '../../common/permissions';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() email: string;
  @Column() passwordHash: string;
  @Column() fullName: string;
  @Column({ type: 'text' }) role: Role;
  @Column({ type: 'text', default: 'fr' }) locale: Lang;
  @Column({ type: 'text', nullable: true }) mfaSecret: string | null;
  @Column({ default: false }) mfaEnabled: boolean;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
