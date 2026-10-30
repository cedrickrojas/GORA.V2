import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { lockAdminAccounts } from '../src/admin/admin.service';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes('@'))
    throw new Error(
      'Usage: npm run admin:bootstrap -- your-account@example.com',
    );
  if (existsSync('.env')) process.loadEnvFile('.env');
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('Set DATABASE_URL in server/.env first.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    await prisma.$transaction(async (tx) => {
      await lockAdminAccounts(tx);
      if (
        await tx.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } })
      ) {
        throw new Error(
          'An active super admin already exists. Use the dashboard to grant additional access.',
        );
      }
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      });
      if (!user?.isActive)
        throw new Error(
          'Register an active account with this email before running this command.',
        );
      await tx.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          targetId: user.id,
          action: 'SUPER_ADMIN_BOOTSTRAPPED',
          details: { source: 'Local setup command' },
        },
      });
    });
    console.log('Super admin enabled. Sign in and open /admin.');
  } catch (error) {
    // Known setup errors are safe; database errors may contain credentials.
    const safe = error instanceof Error && error.constructor === Error;
    console.error(
      safe
        ? error.message
        : 'Setup failed. Check the database connection and apply migrations first.',
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error('Invalid setup. Check the command and server/.env.');
  process.exitCode = 1;
});
