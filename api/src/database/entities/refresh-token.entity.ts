import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Jeton de rafraîchissement rotatif ; seule son empreinte SHA-256 est stockée. */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  /** Tous les jetons issus d'une même connexion partagent la même famille. */
  @Column('uuid') familyId: string;
  @Column() tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
