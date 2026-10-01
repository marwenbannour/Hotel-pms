import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/** Génère openapi.json (contrat publié, section 22.9). */
async function run() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const doc = configureApp(app);
  writeFileSync('openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
  console.log(`openapi.json : ${Object.keys(doc.paths).length} chemins`);
}
run();
