import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { ProblemException } from './common/problem';
import { appConfig } from './config';

const flatten = (errors: ValidationError[], prefix = ''): { field: string; messages: string[] }[] =>
  errors.flatMap((e) => {
    const field = prefix ? `${prefix}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });

/** Configuration commune à l'exécution et aux tests. */
export function configureApp(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  // Les ETag sont ceux des versions de ressources (If-Match), pas des empreintes de contenu.
  app.getHttpAdapter().getInstance().set('etag', false);
  // L'adresse du client (limitation de débit, journaux) est lue dans X-Forwarded-For uniquement
  // si la requête vient d'un proxy de confiance, par défaut le serveur web sur la même machine.
  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.enableCors({ exposedHeaders: ['ETag', 'API-Version', 'X-Request-Id', 'Retry-After', 'Idempotent-Replayed', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'] });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID().replace(/-/g, '').slice(0, 16);
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('API-Version', appConfig.apiVersion);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new ProblemException(422, 'VALIDATION_FAILED', undefined, { errors: flatten(errors) }),
    }),
  );

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API – Système de gestion hôtelière')
      .setDescription('Socle V1 : session, menu dynamique, chambres, clients, disponibilités, réservations, réception.')
      .setVersion(appConfig.apiVersion)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });
  return doc;
}
