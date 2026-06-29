type Env = Record<string, unknown>;

const PRODUCTION_REQUIRED = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

function readString(env: Env, key: string): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(env: Env, key: string, defaultValue: boolean): boolean {
  const value = readString(env, key);
  if (!value) return defaultValue;
  if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false;
  throw new Error(`${key} must be a boolean-like value`);
}

function readPort(env: Env): number {
  const raw = readString(env, 'API_PORT') ?? readString(env, 'PORT') ?? '3000';
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT/PORT must be an integer between 1 and 65535');
  }
  return port;
}

function readPositiveNumber(env: Env, key: string, defaultValue: number): number {
  const raw = readString(env, key);
  if (!raw) return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return value;
}

function validateUrl(value: string, key: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
}

function validateUrlList(env: Env, key: string): void {
  const value = readString(env, key);
  if (!value) return;
  if (value === '*') return;
  value.split(',').map((origin) => origin.trim()).filter(Boolean).forEach((origin) => {
    validateUrl(origin, key);
  });
}

export function validateEnv(env: Env) {
  const nodeEnv = readString(env, 'NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    const missing = PRODUCTION_REQUIRED.filter((key) => !readString(env, key));
    if (missing.length > 0) {
      throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
    }
  }

  validateUrlList(env, 'CORS_ORIGIN');
  validateUrlList(env, 'VITE_API_BASE_URL');

  return {
    ...env,
    NODE_ENV: nodeEnv,
    API_PORT: readPort(env),
    NOTIFY_ENABLED: readBoolean(env, 'NOTIFY_ENABLED', false),
    CHECKIN_MAX_RADIUS_METERS: readPositiveNumber(env, 'CHECKIN_MAX_RADIUS_METERS', 200),
  };
}
