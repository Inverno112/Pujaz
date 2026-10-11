import { describe, expect, it, vi } from 'vitest';
import { buildGateway, createMockClients } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

const ANA = '7';
const LUIS = '9';

function setup() {
  const clients = createMockClients();
  const { yoga, tokenService } = buildGateway(config, clients);

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

  return { graphql, clients, tokenFor: (userId: string) => tokenService.sign(userId) };
}

const WALLET = `{
  wallet {
    userId available reserved
    movements { id type amount createdAt auction { id currentPrice } }
  }
}`;
const DEPOSIT = `mutation ($amount: Float!) {
  deposit(amount: $amount) { available reserved movements { type amount auction { id } } }
}`;
const REGISTER = `mutation { register(input: { name: "Sofía", email: "sofia@correo.com", password: "secreto789" }) { token } }`;

describe('billetera', () => {
  it('1. wallet sin token devuelve UNAUTHENTICATED', async () => {
    const { graphql } = setup();
    const { data, errors } = await graphql(WALLET);
    expect(data).toBeNull();
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('1b. wallet con un token inválido devuelve UNAUTHENTICATED', async () => {
    const { graphql } = setup();
    const { errors } = await graphql(WALLET, undefined, 'token-invalido');
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('2. wallet devuelve available, reserved y los movimientos del más reciente al más antiguo', async () => {
    const { graphql, tokenFor } = setup();
    const { data, errors } = await graphql(WALLET, undefined, await tokenFor(ANA));
    expect(errors).toBeUndefined();
    expect(data.wallet).toMatchObject({ userId: ANA, available: 380000, reserved: 120000 });
    expect(data.wallet.movements.map((movement: any) => movement.type)).toEqual(['RESERVE', 'DEPOSIT']);
    const dates = data.wallet.movements.map((movement: any) => Date.parse(movement.createdAt));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('2b. cada usuario ve solo su billetera (la del token)', async () => {
    const { graphql, tokenFor } = setup();
    const { data } = await graphql(WALLET, undefined, await tokenFor(LUIS));
    expect(data.wallet).toMatchObject({ userId: LUIS, available: 300000, reserved: 0 });
    expect(data.wallet.movements.map((movement: any) => movement.type)).toEqual(['REFUND', 'RESERVE', 'DEPOSIT']);
  });

  it('2c. un usuario recién registrado tiene una billetera vacía', async () => {
    const { graphql } = setup();
    const { data: registered } = await graphql(REGISTER);
    const { data, errors } = await graphql(WALLET, undefined, registered.register.token);
    expect(errors).toBeUndefined();
    expect(data.wallet).toMatchObject({ available: 0, reserved: 0, movements: [] });
  });

  it('3. deposit con monto positivo devuelve la billetera con el saldo aumentado', async () => {
    const { graphql, tokenFor } = setup();
    const token = await tokenFor(ANA);
    const { data, errors } = await graphql(DEPOSIT, { amount: 50000 }, token);
    expect(errors).toBeUndefined();
    expect(data.deposit).toMatchObject({ available: 430000, reserved: 120000 });
    expect(data.deposit.movements[0]).toEqual({ type: 'DEPOSIT', amount: 50000, auction: null });

    const { data: after } = await graphql(WALLET, undefined, token);
    expect(after.wallet.available).toBe(430000);
    expect(after.wallet.movements).toHaveLength(3);
  });

  it.each([0, -1000])('4. deposit(amount: %s) devuelve BAD_USER_INPUT', async (amount) => {
    const { graphql, tokenFor } = setup();
    const { errors } = await graphql(DEPOSIT, { amount }, await tokenFor(ANA));
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('4b. deposit sin token devuelve UNAUTHENTICATED y no cambia ninguna billetera', async () => {
    const { graphql, clients } = setup();
    const spy = vi.spyOn(clients.walletClient, 'deposit');
    const { errors } = await graphql(DEPOSIT, { amount: 50000 });
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('5. los movimientos DEPOSIT tienen auction = null', async () => {
    const { graphql, tokenFor } = setup();
    const { data } = await graphql(WALLET, undefined, await tokenFor(LUIS));
    const deposits = data.wallet.movements.filter((movement: any) => movement.type === 'DEPOSIT');
    expect(deposits).toHaveLength(1);
    expect(deposits[0].auction).toBeNull();
  });

  it('6. RESERVE y REFUND traen su subasta, pedida en una sola llamada para todos', async () => {
    const { graphql, clients, tokenFor } = setup();
    const spy = vi.spyOn(clients.auctionClient, 'getAuctionsByIds');
    const { data, errors } = await graphql(WALLET, undefined, await tokenFor(LUIS));
    expect(errors).toBeUndefined();
    const withAuction = data.wallet.movements.filter((movement: any) => movement.type !== 'DEPOSIT');
    expect(withAuction.map((movement: any) => movement.auction)).toEqual([
      { id: '12', currentPrice: 120000 },
      { id: '12', currentPrice: 120000 },
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('6b. el ítem de las subastas de los movimientos también sale en una sola llamada', async () => {
    const { graphql, clients, tokenFor } = setup();
    const spy = vi.spyOn(clients.itemClient, 'getItemsByIds');
    const { data, errors } = await graphql(
      '{ wallet { movements { auction { item { name } } } } }',
      undefined,
      await tokenFor(LUIS),
    );
    expect(errors).toBeUndefined();
    expect(data.wallet.movements.map((movement: any) => movement.auction?.item.name ?? null)).toEqual([
      'Reloj de bolsillo 1920',
      'Reloj de bolsillo 1920',
      null,
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('6c. si no se pide auction, no se llama al cliente de subastas', async () => {
    const { graphql, clients, tokenFor } = setup();
    const spy = vi.spyOn(clients.auctionClient, 'getAuctionsByIds');
    await graphql('{ wallet { movements { type } } }', undefined, await tokenFor(LUIS));
    expect(spy).not.toHaveBeenCalled();
  });
});
