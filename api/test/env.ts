process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://hotel:hotel@localhost:5432/hotel_test';
process.env.JWT_SECRET = 'test-secret';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.ENABLED_MODULES = 'core';
