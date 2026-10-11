import { requireUser, type GatewayContext } from '../../core/context.js';
import { AppError } from '../../core/errors.js';
import type { Item } from '../catalog/index.js';
import type { WalletMovement } from '../wallet/index.js';
import type { Auction } from './auction.client.js';
import type { AuctionLoaders, AuctionsService, CreateItemInput } from './auctions.service.js';

export function createAuctionsResolvers(auctionsService: AuctionsService) {
  // El contexto es un objeto nuevo en cada petición: así los cargadores no se comparten entre peticiones.
  const loadersByRequest = new WeakMap<GatewayContext, AuctionLoaders>();

  function loaders(ctx: GatewayContext): AuctionLoaders {
    let current = loadersByRequest.get(ctx);
    if (!current) {
      current = auctionsService.createLoaders();
      loadersByRequest.set(ctx, current);
    }
    return current;
  }

  return {
    Query: {
      auction: (_parent: unknown, args: { itemId: string }, ctx: GatewayContext) =>
        loaders(ctx).auctionByItemId.load(args.itemId),
    },
    Mutation: {
      // El usuario sale del token: placeBid no recibe un userId.
      placeBid: (_parent: unknown, args: { auctionId: string; amount: number }, ctx: GatewayContext) =>
        auctionsService.placeBid(requireUser(ctx), args.auctionId, args.amount),
      createItem: async (_parent: unknown, args: { input: CreateItemInput }, ctx: GatewayContext) => {
        requireUser(ctx);
        const { item, auction } = await auctionsService.createItem(args.input);
        // Item.auction ya tiene la subasta recién creada: no hace falta pedirla otra vez.
        loaders(ctx).auctionByItemId.prime(item.id, auction);
        return item;
      },
    },
    Subscription: {
      // Pública: no pide JWT (la subasta y quienes pujan, solo con id y nombre, son datos públicos).
      auctionUpdated: {
        subscribe: (_parent: unknown, args: { auctionId: string }) => auctionsService.subscribeToAuction(args.auctionId),
        resolve: (auction: Auction) => auction,
      },
    },
    Item: {
      auction: (item: Item, _args: unknown, ctx: GatewayContext) => loaders(ctx).auctionByItemId.load(item.id),
    },
    Auction: {
      item: async (auction: Auction, _args: unknown, ctx: GatewayContext) => {
        const item = await loaders(ctx).item.load(auction.itemId);
        if (!item) {
          throw new AppError('NOT_FOUND', 'El ítem de la subasta no existe.');
        }
        return item;
      },
    },
    WalletMovement: {
      // Las recargas no tienen subasta.
      auction: (movement: WalletMovement, _args: unknown, ctx: GatewayContext) =>
        movement.auctionId === null ? null : loaders(ctx).auctionById.load(movement.auctionId),
    },
  };
}
