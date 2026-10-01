import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

/** Entrée du menu dynamique (section 5), paramétrable sans modification du code. */
@Entity('navigation_items')
export class NavigationItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() key: string;
  @Column({ type: 'text', nullable: true }) parentKey: string | null;
  @Column({ type: 'text', nullable: true }) path: string | null;
  @Column({ type: 'text', nullable: true }) icon: string | null;
  /** Permission requise pour voir l'entrée ; null = visible par tout utilisateur connecté. */
  @Column({ type: 'text', nullable: true }) permission: string | null;
  /** Module fonctionnel ; seules les entrées des modules activés sont servies. */
  @Column({ default: 'core' }) module: string;
  @Column() labelFr: string;
  @Column() labelEn: string;
  @Column() labelAr: string;
  @Column({ default: 0 }) sortOrder: number;
  @Column({ default: true }) enabled: boolean;
  @VersionColumn() version: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
