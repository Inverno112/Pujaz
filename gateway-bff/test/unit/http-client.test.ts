import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractError } from '../../src/infrastructure/http/contract.js';
import { HttpClient } from '../../src/infrastructure/http/http-client.js';

function respond(status: number, body?: unknown, raw?: string) {
  const text = raw ?? (body === undefined ? '' : JSON.stringify(body));
  return vi.fn<typeof fetch>(async () => new Response(status === 204 ? null : text, { status }));
}

const passthrough = (body: unknown) => body;

describe('HttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('envía JSON a la URL del MS y devuelve la respuesta validada', async () => {
    const fetchFn = respond(200, { ok: true });
    const http = new HttpClient('MS prueba', 'http://ms:8080/', { fetchFn });
    await expect(http.post('/users', { name: 'Ana' }, passthrough)).resolves.toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://ms:8080/users');
    expect(init).toMatchObject({ method: 'POST', body: '{"name":"Ana"}', redirect: 'manual' });
  });

  it('un 204 llega al validador como undefined', async () => {
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(204) });
    await expect(http.delete('/users/1', passthrough)).resolves.toBeUndefined();
  });

  it('un error { code, message } con un código permitido conserva el código', async () => {
    const http = new HttpClient('MS prueba', 'http://ms', {
      fetchFn: respond(409, { code: 'BID_TOO_LOW', message: 'Bid is too low' }),
    });
    await expect(http.post('/auctions/1/bids', {}, passthrough)).rejects.toMatchObject({ code: 'BID_TOO_LOW' });
  });

  it('un código que no está en el contrato sale como INTERNAL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(500, { code: 'DB_DOWN', message: 'x' }) });
    await expect(http.get('/users/1', passthrough)).rejects.toMatchObject({
      code: 'INTERNAL',
      message: 'Error interno del servidor.',
    });
  });

  it.each([
    [404, 'NOT_FOUND'],
    [422, 'BAD_USER_INPUT'],
    [400, 'BAD_USER_INPUT'],
  ])('traduce el formato de FastAPI: %s -> %s', async (status, code) => {
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(status, { detail: 'Item not found' }) });
    await expect(http.get('/items/x', passthrough)).rejects.toMatchObject({ code });
  });

  it('una ruta que no existe (404 en texto o redirección) sale como INTERNAL y se registra', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notFound = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(404, undefined, '404 page not found') });
    await expect(notFound.post('/auctions', {}, passthrough)).rejects.toMatchObject({ code: 'INTERNAL' });
    const redirect = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(307, undefined, '<a>Redirect</a>') });
    await expect(redirect.get('/auctions?ids=1', passthrough)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('MS prueba POST /auctions: respondió 404'));
  });

  it('una respuesta que no cumple el contrato sale como INTERNAL y el log dice qué falta', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn: respond(200, {}) });
    const parse = () => {
      throw new ContractError('falta User.createdAt');
    };
    await expect(http.get('/users/1', parse)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(log).toHaveBeenCalledWith('[gateway] MS prueba GET /users/1: falta User.createdAt (contrato rest.md)');
  });

  it('un MS caído sale como INTERNAL sin detalles para la SPA', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    });
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn });
    await expect(http.get('/users/1', passthrough)).rejects.toMatchObject({
      code: 'INTERNAL',
      message: 'Error interno del servidor.',
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no responde (ECONNREFUSED)'));
  });

  it('si el MS no responde a tiempo, sale como INTERNAL', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason));
        }),
    );
    const http = new HttpClient('MS prueba', 'http://ms', { fetchFn, timeoutMs: 20 });
    await expect(http.get('/users/1', passthrough)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('sin respuesta en 20 ms'));
  });
});
