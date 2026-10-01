import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { appConfig } from './config';

async function main() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(appConfig.port);
  Logger.log(`API prête sur http://localhost:${appConfig.port}/v1 — documentation : /docs`, 'Bootstrap');
}
main();
