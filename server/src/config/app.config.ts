import { registerAs } from '@nestjs/config';
import {
  readNodeEnv,
  readPort,
  readString,
  resolveCorsOrigins,
} from './env.validation';

export const appConfig = registerAs('app', () => {
  const nodeEnv = readNodeEnv(process.env.NODE_ENV);
  const port = readPort(process.env.PORT);
  const corsOrigins = resolveCorsOrigins(
    nodeEnv,
    readString(process.env.CORS_ORIGIN),
  );

  return {
    nodeEnv,
    port,
    corsOrigins,
  };
});
