import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type Client } from 'graphql-ws';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildGateway, createMockClients } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { attachWebSocket } from '../../src/server.js';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), USE_MOCKS: 'true' });

const OPEN_AUCTION = '12';
const ANA = '7';

const AUCTION_UPDATED = `subscription ($auctionId: ID!) {
  auctionUpdated(auctionId: $auctionId) {
    id currentPrice status
    winningBid { amount bidder { id name } }
    participants { id name }
    item { name }
  }
}`;
const BID = `mutation ($auctionId: ID!, $amount: Float!) { placeBid(auctionId: $auctionId, amount: $amount) { amount } }`;

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanup.length > 0) await cleanup.pop()!();
});

// Gateway real (HTTP + WebSocket) en un puerto libre, con los clientes falsos.
async function startGateway() {
  const { yoga, tokenService } = buildGateway(config, createMockClients());
  const server: Server = createServer(yoga);
  const wsServer = attachWebSocket(server, yoga);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        wsServer.close();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );

  async function graphql(query: string, variables: Record<string, unknown>, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    return response.json() as Promise<any>;
  }

  // Un suscriptor sin token, como la SPA.
  async function subscribe(auctionId: string) {
    const client: Client = createClient({ url: `ws://127.0.0.1:${port}/graphql`, webSocketImpl: WebSocket, lazy: false });
    cleanup.push(() => client.dispose());
    const events: any[] = [];
    const errors: unknown[] = [];
    await new Promise<void>((resolve) => client.on('connected', () => resolve()));
    client.subscribe(
      { query: AUCTION_UPDATED, variables: { auctionId } },
      { next: (value) => events.push(value), error: (error) => errors.push(error), complete: () => {} },
    );
    // Deja que el servidor registre la suscripción antes de pujar.
    await sleep(100);
    return { events, errors };
  }

  return { graphql, subscribe, tokenFor: (userId: string) => tokenService.sign(userId) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('No llegó el evento a tiempo');
    await sleep(20);
  }
}

describe('tiempo real', () => {
  it('7 y 10. dos suscriptores sin token de la misma subasta reciben la subasta actualizada', async () => {
    const gateway = await startGateway();
    const first = await gateway.subscribe(OPEN_AUCTION);
    const second = await gateway.subscribe(OPEN_AUCTION);

    const { errors } = await gateway.graphql(BID, { auctionId: OPEN_AUCTION, amount: 150000 }, await gateway.tokenFor(ANA));
    expect(errors).toBeUndefined();

    await waitFor(() => first.events.length === 1 && second.events.length === 1);
    for (const subscriber of [first, second]) {
      expect(subscriber.errors).toEqual([]);
      expect(subscriber.events[0].data.auctionUpdated).toMatchObject({
        id: OPEN_AUCTION,
        currentPrice: 150000,
        status: 'OPEN',
        winningBid: { amount: 150000, bidder: { id: ANA, name: 'Ana' } },
        item: { name: 'Reloj de bolsillo 1920' },
      });
      expect(subscriber.events[0].data.auctionUpdated.participants).toEqual(
        expect.arrayContaining([{ id: ANA, name: 'Ana' }]),
      );
    }
  });

  it('8. un suscriptor de otra subasta no recibe el evento', async () => {
    const gateway = await startGateway();
    const same = await gateway.subscribe(OPEN_AUCTION);
    const other = await gateway.subscribe('13');

    await gateway.graphql(BID, { auctionId: OPEN_AUCTION, amount: 150000 }, await gateway.tokenFor(ANA));
    await waitFor(() => same.events.length === 1);
    await sleep(100);
    expect(other.events).toEqual([]);
  });

  it('9. si la puja falla, no se publica ningún evento', async () => {
    const gateway = await startGateway();
    const subscriber = await gateway.subscribe(OPEN_AUCTION);

    const { errors } = await gateway.graphql(BID, { auctionId: OPEN_AUCTION, amount: 100 }, await gateway.tokenFor(ANA));
    expect(errors[0].extensions.code).toBe('BID_TOO_LOW');
    await sleep(200);
    expect(subscriber.events).toEqual([]);
  });
});
