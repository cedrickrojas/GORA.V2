import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { API_GLOBAL_PREFIX } from '../common/constants/api.constants';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  // Ten optimized photos fit below Vercel's 4.5 MB request limit. Other routes
  // retain Nest's default JSON limit. Photos and their post save atomically.
  app.use(`/${API_GLOBAL_PREFIX}/posts`, json({ limit: '4mb' }));
  app.use(`/${API_GLOBAL_PREFIX}/profiles/me/cover`, json({ limit: '400kb' }));
  app.use(`/${API_GLOBAL_PREFIX}/chat/direct`, json({ limit: '2mb' }));
  // Nest detects jsonParser by name, including the scoped parser above, so
  // explicitly register the default parser for auth and the other API routes.
  app.use(json());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
