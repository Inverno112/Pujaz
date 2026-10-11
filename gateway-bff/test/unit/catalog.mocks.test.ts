import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockAuctionClient } from '../../src/infrastructure/clients/mock/auction.mock.js';
import { MOCK_ITEM_IDS, MockItemClient } from '../../src/infrastructure/clients/mock/item.mock.js';

describe('MockItemClient', () => {
  it('busca en el nombre y en la descripción, sin distinguir mayúsculas', async () => {
    const client = new MockItemClient();
    expect((await client.searchItems('lámpara')).map((item) => item.id)).toEqual([MOCK_ITEM_IDS.lamp]);
    expect((await client.searchItems('ANDINO')).map((item) => item.id)).toEqual([MOCK_ITEM_IDS.painting]);
  });

  it('getItem responde NOT_FOUND si no existe', async () => {
    await expect(new MockItemClient().getItem('no-existe')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('getItemsByIds omite los ids que no existen', async () => {
    const items = await new MockItemClient().getItemsByIds([MOCK_ITEM_IDS.watch, 'no-existe']);
    expect(items.map((item) => item.id)).toEqual([MOCK_ITEM_IDS.watch]);
  });

  it('devuelve copias: modificar una respuesta no cambia los datos guardados', async () => {
    const client = new MockItemClient();
    const [item] = await client.getItemsByIds([MOCK_ITEM_IDS.watch]);
    item!.name = 'cambiado';
    expect((await client.getItem(MOCK_ITEM_IDS.watch)).name).toBe('Reloj de bolsillo 1920');
  });
});

describe('MockItemClient.createItem', () => {
  it('crea el ítem con id de Mongo y valores vacíos en lo que no se envía', async () => {
    const client = new MockItemClient();
    const item = await client.createItem({ name: 'Radio', basePrice: 1000 });
    expect(item).toMatchObject({ name: 'Radio', description: null, category: null, images: [], documents: [], basePrice: 1000 });
    expect(item.id).toMatch(/^[0-9a-f]{24}$/);
    expect(await client.getItem(item.id)).toEqual(item);
  });

  it.each([
    [{ name: ' ', basePrice: 1000 }],
    [{ name: 'Radio', basePrice: 0 }],
  ])('responde BAD_USER_INPUT con %o', async (input) => {
    await expect(new MockItemClient().createItem(input)).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
  });
});

describe('MockAuctionClient.createAuction', () => {
  const future = () => new Date(Date.now() + 86_400_000).toISOString();

  it('crea una subasta abierta y sin pujas', async () => {
    const client = new MockAuctionClient();
    const auction = await client.createAuction({ itemId: 'nuevo', basePrice: 500, endsAt: future() });
    expect(auction).toMatchObject({ itemId: 'nuevo', basePrice: 500, currentPrice: 500, winningBid: null, status: 'OPEN' });
    expect(await client.getAuctionsByIds([auction.id])).toEqual([auction]);
  });

  it.each([
    ['endsAt en el pasado', { itemId: 'nuevo', basePrice: 500, endsAt: '2020-01-01T00:00:00Z' }],
    ['basePrice 0', { itemId: 'nuevo', basePrice: 0, endsAt: '2099-01-01T00:00:00Z' }],
    ['ítem que ya tiene subasta', { itemId: MOCK_ITEM_IDS.watch, basePrice: 500, endsAt: '2099-01-01T00:00:00Z' }],
  ])('responde BAD_USER_INPUT con %s', async (_case, input) => {
    await expect(new MockAuctionClient().createAuction(input)).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
  });
});

describe('MockAuctionClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('getAuctionsByItemIds([]) devuelve [] y los ítems sin subasta no aparecen', async () => {
    const client = new MockAuctionClient();
    expect(await client.getAuctionsByItemIds([])).toEqual([]);
    expect(await client.getAuctionsByItemIds([MOCK_ITEM_IDS.painting, 'no-existe'])).toEqual([]);
  });

  it('getAuctionsByIds omite los ids que no existen', async () => {
    const client = new MockAuctionClient();
    const auctions = await client.getAuctionsByIds(['13', 'no-existe', '12']);
    expect(auctions.map((auction) => auction.id).sort()).toEqual(['12', '13']);
    expect(await client.getAuctionsByIds([])).toEqual([]);
  });

  it('currentPrice es la puja más alta y participants no repite usuarios', async () => {
    const [auction] = await new MockAuctionClient().getAuctionsByItemIds([MOCK_ITEM_IDS.watch]);
    expect(auction!.currentPrice).toBe(auction!.winningBid!.amount);
    const ids = auction!.participants.map((participant) => participant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('status pasa a CLOSED cuando llega endsAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    const client = new MockAuctionClient();
    const [open] = await client.getAuctionsByItemIds([MOCK_ITEM_IDS.watch]);
    expect(open!.status).toBe('OPEN');

    vi.setSystemTime(new Date(open!.endsAt));
    const [closed] = await client.getAuctionsByItemIds([MOCK_ITEM_IDS.watch]);
    expect(closed!.status).toBe('CLOSED');
  });
});
