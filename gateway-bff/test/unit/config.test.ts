import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config.js';

const VALID_SECRET = 'x'.repeat(32);
const MS_URLS = {
  MS_TRANSACCIONAL_URL: 'http://ms-transaccional:8080',
  MS_CATALOGO_URL: 'http://ms-catalogo:8000',
};

describe('loadConfig', () => {
  it('falla si falta JWT_SECRET', () => {
    expect(() => loadConfig({ USE_MOCKS: 'true' })).toThrow(ConfigError);
    expect(() => loadConfig({ USE_MOCKS: 'true' })).toThrow(/JWT_SECRET/);
  });

  it('falla si JWT_SECRET tiene menos de 32 caracteres', () => {
    const env = { JWT_SECRET: 'x'.repeat(31), USE_MOCKS: 'true' };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/32 caracteres/);
  });

  it('no incluye el valor de JWT_SECRET en el mensaje de error', () => {
    const secret = 'secreto-corto';
    expect(() => loadConfig({ JWT_SECRET: secret, USE_MOCKS: 'true' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });

  it('aplica los valores por defecto', () => {
    const config = loadConfig({ JWT_SECRET: VALID_SECRET, ...MS_URLS });
    expect(config).toEqual({
      jwtSecret: VALID_SECRET,
      jwtExpiresIn: '24h',
      useMocks: false,
      msTransaccionalUrl: MS_URLS.MS_TRANSACCIONAL_URL,
      msCatalogoUrl: MS_URLS.MS_CATALOGO_URL,
      port: 4000,
      corsOrigin: 'http://localhost:5173',
    });
  });

  it('exige las URL de los MS solo si USE_MOCKS=false', () => {
    expect(() => loadConfig({ JWT_SECRET: VALID_SECRET })).toThrow(/MS_TRANSACCIONAL_URL/);
    expect(() =>
      loadConfig({ JWT_SECRET: VALID_SECRET, MS_TRANSACCIONAL_URL: MS_URLS.MS_TRANSACCIONAL_URL }),
    ).toThrow(/MS_CATALOGO_URL/);
    expect(loadConfig({ JWT_SECRET: VALID_SECRET, USE_MOCKS: 'true' }).useMocks).toBe(true);
  });

  it('rechaza USE_MOCKS y PORT inválidos', () => {
    expect(() => loadConfig({ JWT_SECRET: VALID_SECRET, USE_MOCKS: 'si' })).toThrow(/USE_MOCKS/);
    expect(() => loadConfig({ JWT_SECRET: VALID_SECRET, USE_MOCKS: 'true', PORT: 'abc' })).toThrow(/PORT/);
  });
});
