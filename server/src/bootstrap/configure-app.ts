import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_GLOBAL_PREFIX } from '../common/constants/api.constants';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
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
