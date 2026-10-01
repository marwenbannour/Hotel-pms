import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { hotelToday } from '../common/dates';
import { DEMO_PASSWORD, DEMO_USERS, seed, seedDemoDay } from './seed-data';

async function run() {
  const ds = await new DataSource(dataSourceOptions()).initialize();
  await ds.runMigrations();
  await seed(ds);
  if (process.argv.includes('--demo-day')) {
    const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM reservations`);
    if (n > 0) throw new Error('--demo-day : la base contient déjà des réservations.');
    await seedDemoDay(ds, hotelToday());
    console.log('Journée de démonstration créée.');
  }
  await ds.destroy();
  console.log(`Données de démonstration créées. Comptes (mot de passe « ${DEMO_PASSWORD} ») :`);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(13)} ${u.email}`);
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
