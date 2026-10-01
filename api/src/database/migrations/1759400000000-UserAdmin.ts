import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Entrée de menu « Administration > Utilisateurs » pour les bases déjà initialisées.
 * Sur une base neuve, le menu n'existe pas encore : c'est le seed qui la crée.
 */
export class UserAdmin1759400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO navigation_items (key, parent_key, path, icon, permission, label_fr, label_en, label_ar, sort_order)
      SELECT 'admin.users', 'admin', '/admin/users', 'user-cog', 'admin:users', 'Utilisateurs', 'Users', 'المستخدمون', 93
      WHERE EXISTS (SELECT 1 FROM navigation_items WHERE key = 'admin')
      ON CONFLICT (key) DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM navigation_items WHERE key = 'admin.users'`);
  }
}
