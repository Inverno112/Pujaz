import { describe, expect, it } from 'vitest';
import { MockUserClient } from '../../src/infrastructure/clients/mock/user.mock.js';

const NEW_USER = { name: 'Luis', email: 'luis@correo.com', password: 'secreto456' };

describe('MockUserClient', () => {
  it('crea un usuario sin devolver la contraseña', async () => {
    const user = await new MockUserClient().createUser(NEW_USER);
    expect(user).toEqual({ id: expect.any(String), name: 'Luis', email: 'luis@correo.com', createdAt: expect.any(String) });
    expect(user).not.toHaveProperty('password');
  });

  it.each([
    ['nombre vacío', { ...NEW_USER, name: '  ' }],
    ['correo vacío', { ...NEW_USER, email: '' }],
    ['contraseña vacía', { ...NEW_USER, password: '' }],
    ['correo inválido', { ...NEW_USER, email: 'luis-correo.com' }],
    ['contraseña de 7 caracteres', { ...NEW_USER, password: '1234567' }],
  ])('responde BAD_USER_INPUT con %s', async (_case, input) => {
    await expect(new MockUserClient().createUser(input)).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
  });

  it('acepta una contraseña de exactamente 8 caracteres', async () => {
    await expect(new MockUserClient().createUser({ ...NEW_USER, password: '12345678' })).resolves.toBeDefined();
  });

  it('responde EMAIL_TAKEN si el correo ya existe', async () => {
    await expect(new MockUserClient().createUser({ ...NEW_USER, email: 'ana@correo.com' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
  });

  it('INVALID_CREDENTIALS tiene el mismo mensaje si el correo no existe o la contraseña es incorrecta', async () => {
    const client = new MockUserClient();
    const unknownEmail = client.verifyCredentials({ email: 'nadie@correo.com', password: 'secreto123' });
    const wrongPassword = client.verifyCredentials({ email: 'ana@correo.com', password: 'otra-clave' });
    const [a, b] = await Promise.allSettled([unknownEmail, wrongPassword]);
    expect(a).toMatchObject({ status: 'rejected', reason: { code: 'INVALID_CREDENTIALS' } });
    expect(b).toMatchObject({ status: 'rejected', reason: { code: 'INVALID_CREDENTIALS' } });
    expect((a as PromiseRejectedResult).reason.message).toBe((b as PromiseRejectedResult).reason.message);
  });

  it('getUser responde NOT_FOUND si no existe', async () => {
    await expect(new MockUserClient().getUser('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updateUser cambia solo lo enviado y no devuelve la contraseña', async () => {
    const client = new MockUserClient();
    const user = await client.updateUser('7', { name: 'Ana María' });
    expect(user).toEqual({ id: '7', name: 'Ana María', email: 'ana@correo.com', createdAt: '2026-10-09T14:00:00Z' });
    expect(await client.getUser('7')).toEqual(user);
  });

  it('updateUser con el correo de otro usuario responde EMAIL_TAKEN; con el propio no', async () => {
    const client = new MockUserClient();
    const luis = await client.createUser(NEW_USER);
    await expect(client.updateUser('7', { email: NEW_USER.email })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    await expect(client.updateUser(luis.id, { email: NEW_USER.email })).resolves.toMatchObject({ id: luis.id });
  });

  it('updateUser y deleteUser responden NOT_FOUND si el usuario no existe', async () => {
    const client = new MockUserClient();
    await expect(client.updateUser('999', { name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(client.deleteUser('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un updateUser inválido no cambia nada', async () => {
    const client = new MockUserClient();
    await expect(client.updateUser('7', { name: 'Ana María', password: 'corta' })).rejects.toMatchObject({
      code: 'BAD_USER_INPUT',
    });
    expect((await client.getUser('7')).name).toBe('Ana');
  });

  it('deleteUser borra el usuario: ya no se encuentra ni puede iniciar sesión', async () => {
    const client = new MockUserClient();
    await client.deleteUser('7');
    await expect(client.getUser('7')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(client.verifyCredentials({ email: 'ana@correo.com', password: 'secreto123' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('cada instancia empieza con sus propios datos', async () => {
    await new MockUserClient().createUser(NEW_USER);
    await expect(new MockUserClient().createUser(NEW_USER)).resolves.toBeDefined();
  });
});
