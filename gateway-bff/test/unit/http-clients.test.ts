import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpAuctionClient } from '../../src/infrastructure/clients/http/auction.http.js';
import { HttpItemClient } from '../../src/infrastructure/clients/http/item.http.js';
import { HttpUserClient } from '../../src/infrastructure/clients/http/user.http.js';
import { HttpWalletClient } from '../../src/infrastructure/clients/http/wallet.http.js';
import { HttpClient } from '../../src/infrastructure/http/http-client.js';

// Respuestas copiadas de los MS reales (10 de octubre) y del ejemplo de rest.md.
const MS_USER = { id: '4', name: 'Prueba', email: 'prueba@correo.com', role: 'comprador', status: 'activa' };
const CONTRACT_USER = { id: '7', name: 'Ana', email: 'ana@correo.com', createdAt: '2026-10-09T14:00:00Z' };
const MS_WALLET = {
  userId: '4',
  available: 350,
  reserved: 150,
  movements: [
    { id: '7', type: 'RESERVE', amount: 150, auctionId: null, createdAt: '2026-10-11T00:22:40.361263Z' },
    { id: '6', type: 'DEPOSIT', amount: 500, auctionId: null, createdAt: '2026-10-11T00:22:40.353639Z' },
  ],
};
const MS_AUCTION = {
  id: '1',
  itemId: '60d5ec49f1b2c3d4e5f60001',
  basePrice: 100,
  currentPrice: 150,
  winningBid: { id: '1', amount: 150, bidder: { id: '4', name: 'Prueba' }, createdAt: '2026-10-11T00:22:40Z' },
  participants: [{ id: '4', name: 'Prueba' }],
  endsAt: '2026-10-14T00:22:22Z',
  status: 'OPEN',
};
const MS_ITEM = { id: '60d5ec49f1b2c3d4e5f60001', name: 'Reloj', description: 'De bolsillo' };
const CONTRACT_ITEM = { ...MS_ITEM, category: 'Relojes', images: [], documents: [], basePrice: 100000 };

let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

function willRespond(status: number, body?: unknown) {
  fetchFn.mockResolvedValueOnce(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

function lastUrl(): string {
  return String(fetchFn.mock.calls.at(-1)![0]);
}

function http() {
  return new HttpClient('MS prueba', 'http://ms', { fetchFn });
}

beforeEach(() => {
  fetchFn = vi.fn<typeof fetch>();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HttpUserClient', () => {
  it('un usuario sin createdAt no cumple el contrato: INTERNAL', async () => {
    willRespond(200, MS_USER);
    await expect(new HttpUserClient(http()).getUser('4')).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('falta User.createdAt'));
  });

  it('un usuario completo pasa, sin los campos que el contrato no tiene', async () => {
    willRespond(201, { ...CONTRACT_USER, role: 'comprador', status: 'activa' });
    const user = await new HttpUserClient(http()).createUser({ name: 'Ana', email: 'ana@correo.com', password: 'secreto123' });
    expect(user).toEqual(CONTRACT_USER);
    expect(lastUrl()).toBe('http://ms/users');
  });

  it('un usuario con status "inactiva" (borrado) se trata como NOT_FOUND', async () => {
    willRespond(200, { ...MS_USER, name: 'Usuario Eliminado', status: 'inactiva' });
    await expect(new HttpUserClient(http()).getUser('4')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updateUser envía solo los cambios por PATCH', async () => {
    willRespond(200, CONTRACT_USER);
    await new HttpUserClient(http()).updateUser('7', { name: 'Ana' });
    expect(fetchFn.mock.calls[0]![1]).toMatchObject({ method: 'PATCH', body: '{"name":"Ana"}' });
  });

  it('deleteUser acepta el 204 del MS', async () => {
    willRespond(204);
    await expect(new HttpUserClient(http()).deleteUser('4')).resolves.toBeUndefined();
    expect(fetchFn.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' });
  });

  it('los errores del MS conservan su código', async () => {
    willRespond(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    await expect(
      new HttpUserClient(http()).verifyCredentials({ email: 'ana@correo.com', password: 'x' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('HttpWalletClient', () => {
  it('la billetera del MS cumple el contrato', async () => {
    willRespond(200, MS_WALLET);
    await expect(new HttpWalletClient(http()).getWallet('4')).resolves.toEqual(MS_WALLET);
    expect(lastUrl()).toBe('http://ms/users/4/wallet');
  });

  it('deposit envía el monto y conserva BAD_USER_INPUT', async () => {
    willRespond(400, { code: 'BAD_USER_INPUT', message: 'Invalid input' });
    await expect(new HttpWalletClient(http()).deposit('4', 0)).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
    expect(fetchFn.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: '{"amount":0}' });
    expect(lastUrl()).toBe('http://ms/users/4/wallet/deposits');
  });
});

describe('HttpAuctionClient', () => {
  it('pide las subastas de varios ítems en una sola llamada', async () => {
    willRespond(200, [MS_AUCTION]);
    const auctions = await new HttpAuctionClient(http()).getAuctionsByItemIds([MS_AUCTION.itemId, 'otro']);
    expect(auctions).toEqual([MS_AUCTION]);
    expect(lastUrl()).toBe(`http://ms/auctions?itemIds=${MS_AUCTION.itemId},otro`);
  });

  it('si el MS no tiene la consulta en lote (redirección), sale INTERNAL', async () => {
    willRespond(307);
    await expect(new HttpAuctionClient(http()).getAuctionsByIds(['1'])).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('placeBid envía userId y amount, y valida la puja y la subasta que responde el MS', async () => {
    willRespond(201, { bid: MS_AUCTION.winningBid, auction: MS_AUCTION });
    const placed = await new HttpAuctionClient(http()).placeBid('1', '4', 150);
    expect(placed).toEqual({ bid: MS_AUCTION.winningBid, auction: MS_AUCTION });
    expect(lastUrl()).toBe('http://ms/auctions/1/bids');
    expect(fetchFn.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: '{"userId":"4","amount":150}' });
  });

  it.each([
    [409, 'BID_TOO_LOW'],
    [409, 'AUCTION_CLOSED'],
    [422, 'INSUFFICIENT_FUNDS'],
    [404, 'NOT_FOUND'],
  ])('placeBid conserva el error %s %s del MS', async (status, code) => {
    willRespond(status, { code, message: 'x' });
    await expect(new HttpAuctionClient(http()).placeBid('1', '4', 150)).rejects.toMatchObject({ code });
  });

  it('una lista vacía no llama al MS', async () => {
    await expect(new HttpAuctionClient(http()).getAuctionsByIds([])).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('crear ítems con los MS reales (POST /auctions no existe)', () => {
  it('createItem y createAuction responden INTERNAL sin llamar a los MS', async () => {
    await expect(new HttpItemClient(http()).createItem({ name: 'Radio', basePrice: 1000 })).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    await expect(
      new HttpAuctionClient(http()).createAuction({ itemId: 'x', basePrice: 1000, endsAt: '2099-01-01T00:00:00Z' }),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('POST /auctions no existe'));
  });
});

describe('HttpItemClient', () => {
  it('un ítem sin basePrice, category, images ni documents no cumple el contrato: INTERNAL', async () => {
    willRespond(200, [MS_ITEM]);
    await expect(new HttpItemClient(http()).searchItems()).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('falta Item.category'));
  });

  it('un ítem completo pasa', async () => {
    willRespond(200, CONTRACT_ITEM);
    await expect(new HttpItemClient(http()).getItem(MS_ITEM.id)).resolves.toEqual(CONTRACT_ITEM);
  });

  it('busca con el texto codificado en la URL', async () => {
    willRespond(200, []);
    await new HttpItemClient(http()).searchItems('reloj de oro');
    expect(lastUrl()).toBe('http://ms/items?search=reloj%20de%20oro');
  });

  it('el 404 de FastAPI llega como NOT_FOUND', async () => {
    willRespond(404, { detail: 'Item not found' });
    await expect(new HttpItemClient(http()).getItem('x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('si ?ids= devuelve ítems no pedidos (el MS ignora el filtro), sale INTERNAL', async () => {
    willRespond(200, [CONTRACT_ITEM, { ...CONTRACT_ITEM, id: 'otro' }]);
    await expect(new HttpItemClient(http()).getItemsByIds([CONTRACT_ITEM.id])).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ids no pedidos'));
  });
});
