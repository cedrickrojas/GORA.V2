const NODE_ENVS = ['development', 'test', 'production'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

const LOCAL_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:8100'];

export const DEFAULT_JWT_EXPIRES_IN = '7d';

const MIN_JWT_SECRET_LENGTH = 32;
const JWT_EXPIRES_IN_PATTERN = /^\d+[smhd]?$/;

export const DEFAULT_CLUB_MAX_MEMBERS_LIMIT = 1000;
/** Matches the Club_max_members_check constraint in the database. */
export const CLUB_MAX_MEMBERS_CEILING = 100000;

/** The zone that decides what "today" is for game dates (games are local wall-clock times). */
export const DEFAULT_GAME_TIMEZONE = 'Asia/Manila';

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = readNodeEnv(config.NODE_ENV);
  const port = readPort(config.PORT);

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: readDatabaseUrl(config.DATABASE_URL),
    JWT_SECRET: readJwtSecret(config.JWT_SECRET),
    JWT_EXPIRES_IN: readJwtExpiresIn(config.JWT_EXPIRES_IN),
    CORS_ORIGIN: readString(config.CORS_ORIGIN),
    CLUB_MAX_MEMBERS_LIMIT: readClubMaxMembersLimit(
      config.CLUB_MAX_MEMBERS_LIMIT,
    ),
    GAME_TIMEZONE: readGameTimezone(config.GAME_TIMEZONE),
  };
}

/** Reject malformed .env values without including credentials in the error. */
export function readDatabaseUrl(value: unknown): string {
  const connection = readString(value).trim();
  // Keep the health endpoint available when no database has been configured yet.
  if (!connection) return '';
  try {
    const url = new URL(connection);
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2 ||
      /[\s"'`]/.test(connection)
    )
      throw new Error('Invalid PostgreSQL connection string.');
    return connection;
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL URL. Check the opening and closing quotes in server/.env.',
    );
  }
}

export function readGameTimezone(value: unknown): string {
  const timeZone = readString(value).trim();

  if (timeZone.length === 0) {
    return DEFAULT_GAME_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new Error(
      'GAME_TIMEZONE must be an IANA time zone such as Asia/Manila',
    );
  }

  return timeZone;
}

/** The largest maxMembers a club may choose on this platform. */
export function readClubMaxMembersLimit(value: unknown): number {
  if (value === undefined || value === '') {
    return DEFAULT_CLUB_MAX_MEMBERS_LIMIT;
  }

  const limit = typeof value === 'number' ? value : Number(value);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > CLUB_MAX_MEMBERS_CEILING
  ) {
    throw new Error(
      `CLUB_MAX_MEMBERS_LIMIT must be an integer between 1 and ${CLUB_MAX_MEMBERS_CEILING}`,
    );
  }

  return limit;
}

export function readJwtSecret(value: unknown): string {
  const secret = readString(value).trim();

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to a random value of at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }

  return secret;
}

export function readJwtExpiresIn(value: unknown): string {
  const expiresIn = readString(value).trim();

  if (expiresIn.length === 0) {
    return DEFAULT_JWT_EXPIRES_IN;
  }

  if (!JWT_EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error('JWT_EXPIRES_IN must look like 3600, 15m, 12h, or 7d');
  }

  return expiresIn;
}

export function readNodeEnv(value: unknown): NodeEnv {
  const nodeEnv =
    typeof value === 'string' && value.length > 0 ? value : 'development';

  if (isNodeEnv(nodeEnv)) {
    return nodeEnv;
  }

  throw new Error('NODE_ENV must be development, test, or production');
}

export function readPort(value: unknown): number {
  if (value === undefined || value === '') {
    return 3000;
  }

  const port = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function resolveCorsOrigins(
  nodeEnv: NodeEnv,
  rawOrigins: string,
): string[] {
  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length > 0) {
    return origins;
  }

  if (nodeEnv === 'production') {
    return [];
  }

  return [...LOCAL_CORS_ORIGINS];
}

function isNodeEnv(value: string): value is NodeEnv {
  return NODE_ENVS.some((nodeEnv) => nodeEnv === value);
}
