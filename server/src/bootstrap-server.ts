import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
