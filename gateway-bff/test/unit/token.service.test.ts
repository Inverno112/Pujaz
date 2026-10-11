import { decodeJwt } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from '../../src/modules/auth/index.js';

const SECRET = 'x'.repeat(32);
const T0 = new Date('2026-10-09T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('TokenService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('firma un token que verifica con el mismo userId', async () => {
    const tokens = new TokenService(SECRET, '24h');
    const token = await tokens.sign('7');
    await expect(tokens.verify(token)).resolves.toEqual({ userId: '7' });
  });

  it('el token solo contiene sub, iat y exp', async () => {
    const token = await new TokenService(SECRET, '24h').sign('7');
    expect(Object.keys(decodeJwt(token)).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('expira a las 24 horas', async () => {
    const tokens = new TokenService(SECRET, '24h');
    const token = await tokens.sign('7');
    const { iat, exp } = decodeJwt(token);
    expect(exp! - iat!).toBe(24 * 60 * 60);

    vi.setSystemTime(T0.getTime() + 24 * HOUR - 1000);
    await expect(tokens.verify(token)).resolves.toEqual({ userId: '7' });

    vi.setSystemTime(T0.getTime() + 24 * HOUR + 1000);
    await expect(tokens.verify(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rechaza un token alterado', async () => {
    const tokens = new TokenService(SECRET, '24h');
    const token = await tokens.sign('7');
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    await expect(tokens.verify(tampered)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rechaza un token firmado con otra clave', async () => {
    const token = await new TokenService('y'.repeat(32), '24h').sign('7');
    await expect(new TokenService(SECRET, '24h').verify(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rechaza algo que no es un JWT', async () => {
    await expect(new TokenService(SECRET, '24h').verify('no-es-un-token')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
