import { describe, expect, it, vi } from 'vitest';
import { buildGateway, createMockClients } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

function setup() {
  const clients = createMockClients();
  const { yoga } = buildGateway(config, clients);

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

  async function login(email: string, password: string) {
    return graphql(LOGIN, { email, password });
  }

  async function loginAsAna(): Promise<string> {
    const { data } = await login('ana@correo.com', 'secreto123');
    return data.login.token;
  }

  return { graphql, clients, login, loginAsAna };
}

const LOGIN = `mutation ($email: String!, $password: String!) { login(email: $email, password: $password) { token } }`;
const REGISTER = `mutation ($input: RegisterInput!) { register(input: $input) { token user { id } } }`;
const UPDATE = `mutation ($input: UpdateUserInput!) { updateUser(input: $input) { id name email } }`;
const DELETE = `mutation { deleteUser }`;
const ME = `{ me { id name email } }`;
const WALLET = `{ wallet { available } }`;
const DEPOSIT = `mutation ($amount: Float!, $promoCode: String!) { deposit(amount: $amount, promoCode: $promoCode) { available } }`;
const BID = `mutation ($auctionId: ID!, $amount: Float!) { placeBid(auctionId: $auctionId, amount: $amount) { id } }`;

const LUIS = { name: 'Luis', email: 'luis@correo.com', password: 'Secreto456' };

describe('perfil', () => {
  it('1. updateUser y deleteUser sin token devuelven UNAUTHENTICATED y no llaman al MS', async () => {
    const { graphql, clients } = setup();
    const update = vi.spyOn(clients.userClient, 'updateUser');
    const remove = vi.spyOn(clients.userClient, 'deleteUser');
    const responses = await Promise.all([graphql(UPDATE, { input: { name: 'Otro' } }), graphql(DELETE)]);
    for (const { errors } of responses) {
      expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
    }
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('2. updateUser cambia solo los campos enviados', async () => {
    const { graphql, loginAsAna } = setup();
    const token = await loginAsAna();
    const { data, errors } = await graphql(UPDATE, { input: { name: 'Ana María' } }, token);
    expect(errors).toBeUndefined();
    expect(data.updateUser).toEqual({ id: '7', name: 'Ana María', email: 'ana@correo.com' });

    const { data: me } = await graphql(ME, undefined, token);
    expect(me.me.name).toBe('Ana María');
  });

  it('2b. un campo en null no se cambia ni se envía al MS', async () => {
    const { graphql, clients, loginAsAna } = setup();
    const spy = vi.spyOn(clients.userClient, 'updateUser');
    const { data, errors } = await graphql(UPDATE, { input: { name: null, email: null } }, await loginAsAna());
    expect(errors).toBeUndefined();
    expect(data.updateUser).toEqual({ id: '7', name: 'Ana', email: 'ana@correo.com' });
    expect(spy).toHaveBeenCalledWith('7', {});
  });

  it('2c. updateUser actúa sobre el usuario del token, no sobre otros', async () => {
    const { graphql } = setup();
    const { data: registered } = await graphql(REGISTER, { input: LUIS });
    const luisToken = registered.register.token;
    await graphql(UPDATE, { input: { name: 'Luis Felipe' } }, luisToken);

    const { data } = await graphql(ME, undefined, luisToken);
    expect(data.me).toMatchObject({ id: registered.register.user.id, name: 'Luis Felipe' });
  });

  it('2d. cambiar la contraseña hace que el login use la nueva', async () => {
    const { graphql, login, loginAsAna } = setup();
    await graphql(UPDATE, { input: { password: 'Nueva-clave-123' } }, await loginAsAna());

    const old = await login('ana@correo.com', 'secreto123');
    expect(old.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
    const { data, errors } = await login('ana@correo.com', 'Nueva-clave-123');
    expect(errors).toBeUndefined();
    expect(data.login.token).toEqual(expect.any(String));
  });

  it('3. updateUser con un correo de otro usuario devuelve EMAIL_TAKEN', async () => {
    const { graphql, loginAsAna } = setup();
    await graphql(REGISTER, { input: LUIS });
    const { errors } = await graphql(UPDATE, { input: { email: LUIS.email } }, await loginAsAna());
    expect(errors[0].extensions.code).toBe('EMAIL_TAKEN');
  });

  it('3b. updateUser con su propio correo no es un error', async () => {
    const { graphql, loginAsAna } = setup();
    const { errors } = await graphql(UPDATE, { input: { email: 'ana@correo.com' } }, await loginAsAna());
    expect(errors).toBeUndefined();
  });

  it.each([
    ['nombre vacío', { name: '  ' }],
    ['correo inválido', { email: 'ana-correo.com' }],
    ['contraseña de 7 caracteres', { password: '1234567' }],
  ])('3c. updateUser con %s devuelve BAD_USER_INPUT', async (_case, input) => {
    const { graphql, loginAsAna } = setup();
    const { errors } = await graphql(UPDATE, { input }, await loginAsAna());
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('4. deleteUser devuelve true y después la cuenta ya no existe', async () => {
    const { graphql, login, loginAsAna } = setup();
    const token = await loginAsAna();
    const { data, errors } = await graphql(DELETE, undefined, token);
    expect(errors).toBeUndefined();
    expect(data.deleteUser).toBe(true);

    const again = await login('ana@correo.com', 'secreto123');
    expect(again.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
  });

  it('4b. después de deleteUser, el token de la cuenta borrada ya no sirve', async () => {
    const { graphql, clients, loginAsAna } = setup();
    const token = await loginAsAna();
    await graphql(DELETE, undefined, token);
    const deposit = vi.spyOn(clients.walletClient, 'deposit');
    const bid = vi.spyOn(clients.auctionClient, 'placeBid');

    const responses = await Promise.all([
      graphql(ME, undefined, token),
      graphql(WALLET, undefined, token),
      graphql(DEPOSIT, { amount: 1000, promoCode: 'PROMO2026' }, token),
      graphql(BID, { auctionId: '12', amount: 999999 }, token),
      graphql(UPDATE, { input: { name: 'Otra' } }, token),
      graphql(DELETE, undefined, token),
    ]);
    for (const { errors } of responses) {
      expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
    }
    expect(deposit).not.toHaveBeenCalled();
    expect(bid).not.toHaveBeenCalled();
  });

  it('4c. si el MS falla al revisar el usuario, el token se acepta y las consultas públicas siguen', async () => {
    const { graphql, clients, loginAsAna } = setup();
    const token = await loginAsAna();
    vi.spyOn(clients.userClient, 'getUser').mockRejectedValueOnce(new Error('MS caído'));
    const { data, errors } = await graphql(`{ items { id } }`, undefined, token);
    expect(errors).toBeUndefined();
    expect(data.items.length).toBeGreaterThan(0);
  });
});
