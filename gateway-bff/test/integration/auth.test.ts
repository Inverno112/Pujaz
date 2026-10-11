import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGateway } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

function setup() {
  const { yoga, tokenService } = buildGateway(config);

  async function graphql(query: string, variables?: Record<string, unknown>, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token !== undefined) headers.authorization = `Bearer ${token}`;
    const response = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    return response.json() as Promise<any>;
  }

  async function loginAsAna(): Promise<string> {
    const { data } = await graphql(LOGIN, { email: 'ana@correo.com', password: 'secreto123' });
    return data.login.token;
  }

  return { graphql, loginAsAna, tokenService };
}

const REGISTER = `mutation ($input: RegisterInput!) { register(input: $input) { token user { id name email createdAt } } }`;
const LOGIN = `mutation ($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id name email } } }`;
const ME = `{ me { id name email } }`;

const NEW_USER = { name: 'Luis', email: 'luis@correo.com', password: 'secreto456' };

describe('autenticación', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. register válido devuelve token y user, y el token verifica', async () => {
    const { graphql, tokenService } = setup();
    const { data, errors } = await graphql(REGISTER, { input: NEW_USER });
    expect(errors).toBeUndefined();
    expect(data.register.user).toMatchObject({ name: 'Luis', email: 'luis@correo.com' });
    await expect(tokenService.verify(data.register.token)).resolves.toEqual({ userId: data.register.user.id });
  });

  it('2. register con correo repetido devuelve EMAIL_TAKEN', async () => {
    const { graphql } = setup();
    const { errors } = await graphql(REGISTER, { input: { ...NEW_USER, email: 'ana@correo.com' } });
    expect(errors[0].extensions.code).toBe('EMAIL_TAKEN');
  });

  it('register con contraseña corta devuelve BAD_USER_INPUT', async () => {
    const { graphql } = setup();
    const { errors } = await graphql(REGISTER, { input: { ...NEW_USER, password: '1234567' } });
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('3. login correcto devuelve token y user', async () => {
    const { graphql } = setup();
    const { data } = await graphql(LOGIN, { email: 'ana@correo.com', password: 'secreto123' });
    expect(data.login.token).toEqual(expect.any(String));
    expect(data.login.user).toEqual({ id: '7', name: 'Ana', email: 'ana@correo.com' });
  });

  it('4. login con contraseña incorrecta devuelve INVALID_CREDENTIALS', async () => {
    const { graphql } = setup();
    const { errors } = await graphql(LOGIN, { email: 'ana@correo.com', password: 'otra-clave' });
    expect(errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
  });

  it('5. me sin encabezado devuelve UNAUTHENTICATED', async () => {
    const { graphql } = setup();
    const { errors } = await graphql(ME);
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('6. me con token válido devuelve el usuario del token', async () => {
    const { graphql, loginAsAna } = setup();
    const { data } = await graphql(ME, undefined, await loginAsAna());
    expect(data.me).toEqual({ id: '7', name: 'Ana', email: 'ana@correo.com' });
  });

  it('6b. me devuelve al usuario recién registrado con su propio token', async () => {
    const { graphql } = setup();
    const { data: registered } = await graphql(REGISTER, { input: NEW_USER });
    const { data } = await graphql(ME, undefined, registered.register.token);
    expect(data.me.email).toBe('luis@correo.com');
  });

  it('7. me con token alterado devuelve UNAUTHENTICATED', async () => {
    const { graphql, loginAsAna } = setup();
    const token = await loginAsAna();
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    const { errors } = await graphql(ME, undefined, tampered);
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('7. me con token expirado devuelve UNAUTHENTICATED', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    const { graphql, loginAsAna } = setup();
    const token = await loginAsAna();

    vi.setSystemTime(new Date('2026-10-10T12:00:01Z'));
    const { errors } = await graphql(ME, undefined, token);
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('una operación pública con token inválido se ejecuta como si no hubiera token', async () => {
    const { graphql } = setup();
    const { data, errors } = await graphql(REGISTER, { input: NEW_USER }, 'token-invalido');
    expect(errors).toBeUndefined();
    expect(data.register.user.email).toBe('luis@correo.com');
  });

  it('la contraseña nunca aparece en la respuesta', async () => {
    const { graphql } = setup();
    const response = await graphql(REGISTER, { input: NEW_USER });
    expect(JSON.stringify(response)).not.toContain(NEW_USER.password);
  });
});
