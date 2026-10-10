import { describe, expect, it } from 'vitest';
import { MockWalletClient } from '../../src/infrastructure/clients/mock/wallet.mock.js';

describe('MockWalletClient', () => {
  it('arranca con la billetera de Ana del ejemplo del contrato', async () => {
    const wallet = await new MockWalletClient().getWallet('7');
    expect(wallet).toMatchObject({ userId: '7', available: 380000, reserved: 120000 });
    expect(wallet.movements.map(({ id, type, auctionId }) => ({ id, type, auctionId }))).toEqual([
      { id: '301', type: 'RESERVE', auctionId: '12' },
      { id: '300', type: 'DEPOSIT', auctionId: null },
    ]);
  });

  it('deposit suma a available y agrega el movimiento al principio', async () => {
    const client = new MockWalletClient();
    const wallet = await client.deposit('7', 20000);
    expect(wallet.available).toBe(400000);
    expect(wallet.reserved).toBe(120000);
    expect(wallet.movements[0]).toMatchObject({ type: 'DEPOSIT', amount: 20000, auctionId: null });
    expect(await client.getWallet('7')).toEqual(wallet);
  });

  it.each([0, -1, Number.NaN])('deposit(%s) responde BAD_USER_INPUT y no cambia nada', async (amount) => {
    const client = new MockWalletClient();
    await expect(client.deposit('7', amount)).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
    expect((await client.getWallet('7')).available).toBe(380000);
  });

  it('un usuario sin billetera guardada recibe una vacía', async () => {
    const client = new MockWalletClient();
    expect(await client.getWallet('100')).toEqual({ userId: '100', available: 0, reserved: 0, movements: [] });
    expect((await client.deposit('100', 1000)).available).toBe(1000);
  });

  it('devuelve copias: modificar una respuesta no cambia los datos guardados', async () => {
    const client = new MockWalletClient();
    const wallet = await client.getWallet('7');
    wallet.available = 0;
    wallet.movements.pop();
    const again = await client.getWallet('7');
    expect(again.available).toBe(380000);
    expect(again.movements).toHaveLength(2);
  });
});
