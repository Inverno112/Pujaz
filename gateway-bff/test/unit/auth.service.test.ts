import { describe, expect, it } from 'vitest';
import { requireUser } from '../../src/core/context.js';
import { MockUserClient } from '../../src/infrastructure/clients/mock/user.mock.js';
import { AuthService, TokenService } from '../../src/modules/auth/index.js';

const tokens = new TokenService('x'.repeat(32), '24h');

describe('AuthService', () => {
  it('register crea el usuario y firma un token con su id', async () => {
    const auth = new AuthService(new MockUserClient(), tokens);
    const { token, user } = await auth.register({ name: 'Luis', email: 'luis@correo.com', password: 'Secreto456' });
    await expect(tokens.verify(token)).resolves.toEqual({ userId: user.id });
  });

  it('login firma un token con el id del usuario', async () => {
    const auth = new AuthService(new MockUserClient(), tokens);
    const { token, user } = await auth.login({ email: 'ana@correo.com', password: 'secreto123' });
    expect(user.id).toBe('7');
    await expect(tokens.verify(token)).resolves.toEqual({ userId: '7' });
  });

  it('login reenvía el error del cliente sin firmar nada', async () => {
    const auth = new AuthService(new MockUserClient(), tokens);
    await expect(auth.login({ email: 'ana@correo.com', password: 'mala-clave' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('resolveUserId devuelve el userId de un token válido de un usuario que existe', async () => {
    const auth = new AuthService(new MockUserClient(), tokens);
    await expect(auth.resolveUserId(await tokens.sign('7'))).resolves.toBe('7');
  });

  it('resolveUserId devuelve null con un token inválido', async () => {
    const auth = new AuthService(new MockUserClient(), tokens);
    await expect(auth.resolveUserId('no-es-un-jwt')).resolves.toBeNull();
  });

  it('resolveUserId devuelve null si el usuario fue borrado', async () => {
    const users = new MockUserClient();
    const auth = new AuthService(users, tokens);
    const token = await tokens.sign('7');
    await users.deleteUser('7');
    await expect(auth.resolveUserId(token)).resolves.toBeNull();
  });
});

describe('requireUser', () => {
  it('devuelve el userId si hay usuario', () => {
    expect(requireUser({ userId: '7' })).toBe('7');
  });

  it('lanza UNAUTHENTICATED si no hay usuario', () => {
    expect(() => requireUser({ userId: null })).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
});
