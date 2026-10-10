import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The Prisma 7 CLI does not load .env files on its own.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // Read directly so `prisma generate` works before DATABASE_URL is set.
    url: process.env.DATABASE_URL,
  },
});
