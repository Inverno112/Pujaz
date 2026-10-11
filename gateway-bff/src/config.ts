export class ConfigError extends Error {
  override name = 'ConfigError';
}

export interface Config {
  jwtSecret: string;
  jwtExpiresIn: string;
  useMocks: boolean;
  msTransaccionalUrl: string | null;
  msCatalogoUrl: string | null;
  port: number;
  corsOrigin: string;
}

const MIN_JWT_SECRET_LENGTH = 32;

// Contrato del equipo en docs/contrato/ de la raíz del repositorio. La ruta es relativa al
// archivo compilado: vale igual desde src/ (tsx) y desde dist/ (build y Docker).
export const SCHEMA_PATH = new URL('../../docs/contrato/schema.graphql', import.meta.url);

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new ConfigError('Falta la variable de entorno JWT_SECRET.');
  }
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new ConfigError(`JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres.`);
  }

  const useMocks = parseBoolean('USE_MOCKS', env.USE_MOCKS, false);
  const msTransaccionalUrl = env.MS_TRANSACCIONAL_URL || null;
  const msCatalogoUrl = env.MS_CATALOGO_URL || null;
  if (!useMocks) {
    if (!msTransaccionalUrl) {
      throw new ConfigError('Falta MS_TRANSACCIONAL_URL (obligatoria si USE_MOCKS=false).');
    }
    if (!msCatalogoUrl) {
      throw new ConfigError('Falta MS_CATALOGO_URL (obligatoria si USE_MOCKS=false).');
    }
  }

  return {
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '24h',
    useMocks,
    msTransaccionalUrl,
    msCatalogoUrl,
    port: parsePort(env.PORT),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
  };
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ConfigError(`${name} debe ser "true" o "false".`);
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return 4000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT debe ser un número entero entre 1 y 65535.');
  }
  return port;
}
