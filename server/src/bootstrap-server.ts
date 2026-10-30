import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

async function bootstrap(): Promise<void> {
  // configureApp registers route-specific JSON limits (including the larger
  // profile photo payload), so don't let Nest install its default 100 KB
  // parser ahead of those routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);

  configureApp(app);
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Failed to start GORA API';
  console.error(message);
  process.exit(1);
});
