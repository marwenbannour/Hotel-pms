/** Configuration centralisée, lue une seule fois depuis les variables d'environnement. */
const env = process.env;

if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET est obligatoire en production');
}

export const appConfig = {
  port: parseInt(env.PORT ?? '3000', 10),
  apiVersion: '1.0.0',
  publicBaseUrl: env.PUBLIC_BASE_URL ?? 'https://api.hotel.local',
  databaseUrl: env.DATABASE_URL ?? 'postgres://hotel:hotel@localhost:5432/hotel',
  jwt: {
    secret: env.JWT_SECRET ?? 'dev-only-secret-change-me',
    accessTtlSeconds: 15 * 60,
    mfaTtlSeconds: 5 * 60,
    refreshTtlDays: 30,
  },
  hotel: {
    name: env.HOTEL_NAME ?? 'Hotel',
    timezone: env.HOTEL_TZ ?? 'Europe/Paris',
    currency: env.HOTEL_CURRENCY ?? 'EUR',
    /** Supplément pension par personne et par nuit, en unités mineures. */
    boardSupplement: {
      room_only: 0,
      half_board: parseInt(env.HALF_BOARD_SUPPLEMENT ?? '2500', 10),
      full_board: parseInt(env.FULL_BOARD_SUPPLEMENT ?? '4500', 10),
    } as Record<string, number>,
  },
  rateLimit: {
    defaultPerMinute: parseInt(env.RATE_LIMIT_PER_MINUTE ?? '600', 10),
    authPerMinute: parseInt(env.AUTH_RATE_LIMIT_PER_MINUTE ?? '10', 10),
  },
  pagination: { defaultLimit: 50, maxLimit: 200 },
  idempotencyTtlHours: 24,
};
