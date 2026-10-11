import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGateway, createMockClients } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

const DAY = 24 * 60 * 60 * 1000;

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

const CREATE = `mutation ($input: CreateItemInput!) {
  createItem(input: $input) {
    id name description category images documents basePrice
    auction { id currentPrice status endsAt winningBid { amount } participants { id } }
  }
}`;

const INPUT = {
  name: 'Máquina de escribir Olivetti',
  description: 'Funciona, con estuche',
  category: 'Antigüedades',
  images: ['https://picsum.photos/seed/olivetti/600/400'],
  basePrice: 300000,
};

describe('crear ítem', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. createItem sin token devuelve UNAUTHENTICATED y no llama a los MS', async () => {
    const { graphql, clients } = setup();
    const createItem = vi.spyOn(clients.itemClient, 'createItem');
    const createAuction = vi.spyOn(clients.auctionClient, 'createAuction');
    const { errors } = await graphql(CREATE, { input: INPUT });
    expect(errors[0].extensions.code).toBe('UNAUTHENTICATED');
    expect(createItem).not.toHaveBeenCalled();
    expect(createAuction).not.toHaveBeenCalled();
  });

  it('2. createItem válido crea el ítem y su subasta, y devuelve el ítem con auction', async () => {
    const { graphql, clients, tokenFor } = setup();
    const createItem = vi.spyOn(clients.itemClient, 'createItem');
    const createAuction = vi.spyOn(clients.auctionClient, 'createAuction');
    const byItemIds = vi.spyOn(clients.auctionClient, 'getAuctionsByItemIds');

    const { data, errors } = await graphql(CREATE, { input: INPUT }, await tokenFor('7'));
    expect(errors).toBeUndefined();
    expect(data.createItem).toMatchObject({
      name: INPUT.name,
      description: INPUT.description,
      category: INPUT.category,
      images: INPUT.images,
      documents: [],
      basePrice: 300000,
      auction: { currentPrice: 300000, status: 'OPEN', winningBid: null, participants: [] },
    });
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createAuction).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: data.createItem.id, basePrice: 300000 }),
    );
    // La subasta recién creada ya está en el cargador: no se vuelve a pedir.
    expect(byItemIds).not.toHaveBeenCalled();
  });

  it('2b. el ítem creado aparece en el listado con su subasta', async () => {
    const { graphql, tokenFor } = setup();
    const { data: created } = await graphql(CREATE, { input: INPUT }, await tokenFor('7'));
    const { data } = await graphql('{ items(search: "olivetti") { id auction { id } } }');
    expect(data.items).toEqual([{ id: created.createItem.id, auction: { id: created.createItem.auction.id } }]);
  });

  it('2c. sin endsAt, la subasta dura 14 días', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    const { graphql, tokenFor } = setup();
    const { data } = await graphql(CREATE, { input: INPUT }, await tokenFor('7'));
    expect(Date.parse(data.createItem.auction.endsAt)).toBe(Date.parse('2026-10-11T12:00:00Z') + 14 * DAY);
  });

  it('2d. con endsAt, se usa la fecha enviada, sin tope del Gateway', async () => {
    const { graphql, tokenFor } = setup();
    const endsAt = new Date(Date.now() + 60 * DAY).toISOString();
    const { data, errors } = await graphql(CREATE, { input: { ...INPUT, endsAt } }, await tokenFor('7'));
    expect(errors).toBeUndefined();
    expect(data.createItem.auction.endsAt).toBe(endsAt);
  });

  it.each([
    ['nombre vacío', { name: '  ' }],
    ['precio base 0', { basePrice: 0 }],
    ['precio base negativo', { basePrice: -5 }],
  ])('3. createItem con %s devuelve BAD_USER_INPUT y no crea subasta', async (_case, change) => {
    const { graphql, clients, tokenFor } = setup();
    const createAuction = vi.spyOn(clients.auctionClient, 'createAuction');
    const { errors } = await graphql(CREATE, { input: { ...INPUT, ...change } }, await tokenFor('7'));
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(createAuction).not.toHaveBeenCalled();
  });

  it('4. si el ítem se crea pero la subasta falla, devuelve el error y lo deja en el log', async () => {
    const { graphql, tokenFor } = setup();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const endsAt = new Date(Date.now() - DAY).toISOString();
    const { errors } = await graphql(CREATE, { input: { ...INPUT, endsAt } }, await tokenFor('7'));
    expect(errors[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/el ítem \w+ se creó pero su subasta no/), expect.anything());
  });
});
