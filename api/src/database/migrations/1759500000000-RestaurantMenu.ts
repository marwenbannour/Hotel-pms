import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * L'entrée « Restaurant » mène désormais à la facturation à la chambre : réservée aux profils
 * qui peuvent porter une consommation (sinon le ménage la verrait dès l'activation du module).
 * Une permission choisie par l'administrateur n'est pas remplacée.
 */
export class RestaurantMenu1759500000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE navigation_items SET permission = 'billing:charge', version = version + 1 WHERE key = 'restaurant' AND permission IS NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE navigation_items SET permission = NULL, version = version + 1 WHERE key = 'restaurant' AND permission = 'billing:charge'`,
    );
  }
}
