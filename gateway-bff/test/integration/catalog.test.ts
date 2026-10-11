import { describe, expect, it, vi } from 'vitest';
import { buildGateway, createMockClients } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { MOCK_ITEM_IDS } from '../../src/infrastructure/clients/mock/item.mock.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

function setup() {
  const clients = createMockClients();
  const { yoga } = buildGateway(config, clients);

  async function graphql(query: string, variables?: Record<string, unknown>, headers: Record<string, string> = {}) {
    const response = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ query, variables }),
    });
    return response.json() as Promise<any>;
  }

  return { graphql, clients };
}

const AUCTION = `query ($itemId: ID!) {
  auction(itemId: $itemId) {
    id currentPrice status endsAt
    item { id name description category images documents basePrice }
    winningBid { amount bidder { id name } }
    participants { id name }
  }
}`;

describe('lecturas del catálogo y las subastas', () => {
  it('1. items sin argumento devuelve todos los ítems', async () => {
    const { graphql } = setup();
    const { data, errors } = await graphql('{ items { id name } }');
    expect(errors).toBeUndefined();
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([
      MOCK_ITEM_IDS.watch,
      MOCK_ITEM_IDS.lamp,
      MOCK_ITEM_IDS.painting,
    ]);
  });

  it.each(['reloj', 'RELOJ', 'funcionando'])('2. items(search: "%s") devuelve solo los que coinciden', async (search) => {
    const { graphql } = setup();
    const { data } = await graphql('query ($search: String) { items(search: $search) { id } }', { search });
    expect(data.items).toEqual([{ id: MOCK_ITEM_IDS.watch }]);
  });

  it('2b. una búsqueda sin coincidencias devuelve una lista vacía', async () => {
    const { graphql } = setup();
    const { data } = await graphql('{ items(search: "bicicleta") { id } }');
    expect(data.items).toEqual([]);
  });

  it('3. item(id) con un id inexistente devuelve null, no un error', async () => {
    const { graphql } = setup();
    const response = await graphql('{ item(id: "no-existe") { id } }');
    expect(response).toEqual({ data: { item: null } });
  });

  it('item(id) existente devuelve el ítem', async () => {
    const { graphql } = setup();
    const { data } = await graphql('query ($id: ID!) { item(id: $id) { name basePrice } }', { id: MOCK_ITEM_IDS.watch });
    expect(data.item).toEqual({ name: 'Reloj de bolsillo 1920', basePrice: 100000 });
  });

  it('4. auction(itemId) devuelve el precio actual, el estado y el item completo', async () => {
    const { graphql } = setup();
    const { data, errors } = await graphql(AUCTION, { itemId: MOCK_ITEM_IDS.watch });
    expect(errors).toBeUndefined();
    expect(data.auction).toMatchObject({
      id: '12',
      currentPrice: 120000,
      status: 'OPEN',
      item: {
        id: MOCK_ITEM_IDS.watch,
        name: 'Reloj de bolsillo 1920',
        description: 'Plata, funcionando',
        category: 'Relojes',
        basePrice: 100000,
      },
      winningBid: { amount: 120000, bidder: { id: '7', name: 'Ana' } },
    });
    expect(data.auction.participants).toHaveLength(2);
  });

  it('4b. una subasta cerrada y sin pujas tiene status CLOSED y currentPrice = basePrice', async () => {
    const { graphql } = setup();
    const { data } = await graphql(AUCTION, { itemId: MOCK_ITEM_IDS.lamp });
    expect(data.auction).toMatchObject({
      status: 'CLOSED',
      currentPrice: 250000,
      winningBid: null,
      participants: [],
    });
  });

  it('5. auction(itemId) de un ítem sin subasta devuelve null', async () => {
    const { graphql } = setup();
    const response = await graphql(AUCTION, { itemId: MOCK_ITEM_IDS.painting });
    expect(response).toEqual({ data: { auction: null } });
  });

  it('6. items { name auction { currentPrice } } hace una sola llamada a getAuctionsByItemIds', async () => {
    const { graphql, clients } = setup();
    const spy = vi.spyOn(clients.auctionClient, 'getAuctionsByItemIds');
    const { data } = await graphql('{ items { name auction { currentPrice } } }');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].sort()).toEqual(Object.values(MOCK_ITEM_IDS).sort());
    expect(data.items.map((item: any) => item.auction?.currentPrice ?? null)).toEqual([120000, 250000, null]);
  });

  it('6b. items { auction { item } } hace una sola llamada a getItemsByIds', async () => {
    const { graphql, clients } = setup();
    const spy = vi.spyOn(clients.itemClient, 'getItemsByIds');
    const { errors } = await graphql('{ items { auction { item { name } } } }');
    expect(errors).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('6c. si no se pide auction, no se llama al cliente de subastas', async () => {
    const { graphql, clients } = setup();
    const spy = vi.spyOn(clients.auctionClient, 'getAuctionsByItemIds');
    await graphql('{ items { name } }');
    expect(spy).not.toHaveBeenCalled();
  });

  it('7. ninguna de estas operaciones pide JWT, ni falla con un token inválido', async () => {
    const { graphql } = setup();
    const headers = { authorization: 'Bearer token-invalido' };
    const responses = await Promise.all([
      graphql('{ items { id auction { id } } }', undefined, headers),
      graphql('{ item(id: "no-existe") { id } }', undefined, headers),
      graphql(AUCTION, { itemId: MOCK_ITEM_IDS.watch }, headers),
    ]);
    for (const response of responses) {
      expect(response.errors).toBeUndefined();
    }
  });
});
