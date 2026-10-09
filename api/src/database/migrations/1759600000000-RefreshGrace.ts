import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Date de rotation des jetons de rafraîchissement : un jeton remplacé il y a quelques secondes
 * reste accepté (requêtes simultanées traitées par plusieurs instances du serveur web).
 */
export class RefreshGrace1759600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE refresh_tokens ADD COLUMN rotated_at timestamptz`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE refresh_tokens DROP COLUMN rotated_at`);
  }
}
