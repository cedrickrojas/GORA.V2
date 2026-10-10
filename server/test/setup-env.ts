// Runs before any test module is imported, so ConfigModule validation sees these.
// process.env wins over server/.env, keeping unit tests independent of local secrets.
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.JWT_EXPIRES_IN = '1h';
