import { readFileSync } from 'node:fs';
import { SCHEMA_PATH, type Config } from './config.js';
import { MockAuctionClient } from './infrastructure/clients/mock/auction.mock.js';
import { MockItemClient } from './infrastructure/clients/mock/item.mock.js';
import { MockUserClient } from './infrastructure/clients/mock/user.mock.js';
import { MockWalletClient } from './infrastructure/clients/mock/wallet.mock.js';
import { AuctionsService, createAuctionsResolvers, type AuctionClient } from './modules/auctions/index.js';
import { AuthService, TokenService, createAuthResolvers } from './modules/auth/index.js';
import { CatalogService, createCatalogResolvers, type ItemClient } from './modules/catalog/index.js';
import { UsersService, createUsersResolvers, type UserClient } from './modules/users/index.js';
import { WalletService, createWalletResolvers, type WalletClient } from './modules/wallet/index.js';
import { createGateway } from './server.js';

export interface Clients {
  userClient: UserClient;
  itemClient: ItemClient;
  auctionClient: AuctionClient;
  walletClient: WalletClient;
}

// Único lugar donde se cablean las dependencias.
export function buildGateway(config: Config, clients: Clients = createMockClients()) {
  const tokenService = new TokenService(config.jwtSecret, config.jwtExpiresIn);
  const authService = new AuthService(clients.userClient, tokenService);
  const usersService = new UsersService(clients.userClient);
  const catalogService = new CatalogService(clients.itemClient);
  const auctionsService = new AuctionsService(clients.auctionClient, catalogService);
  const walletService = new WalletService(clients.walletClient);

  const authResolvers = createAuthResolvers(authService);
  const usersResolvers = createUsersResolvers(usersService);
  const catalogResolvers = createCatalogResolvers(catalogService);
  const auctionsResolvers = createAuctionsResolvers(auctionsService);
  const walletResolvers = createWalletResolvers(walletService);

  const yoga = createGateway({
    typeDefs: readFileSync(SCHEMA_PATH, 'utf8'),
    resolvers: {
      Query: {
        ...usersResolvers.Query,
        ...catalogResolvers.Query,
        ...auctionsResolvers.Query,
        ...walletResolvers.Query,
      },
      Mutation: { ...authResolvers.Mutation, ...usersResolvers.Mutation, ...walletResolvers.Mutation },
      Item: { ...auctionsResolvers.Item },
      Auction: { ...auctionsResolvers.Auction },
      WalletMovement: { ...auctionsResolvers.WalletMovement },
    },
    corsOrigin: config.corsOrigin,
    getUserId: async (token) => {
      if (token === null) return null;
      try {
        return (await tokenService.verify(token)).userId;
      } catch {
        // Token inválido: las operaciones públicas siguen y las protegidas responden UNAUTHENTICATED.
        return null;
      }
    },
  });

  return { yoga, tokenService };
}

export function createMockClients(): Clients {
  return {
    userClient: new MockUserClient(),
    itemClient: new MockItemClient(),
    auctionClient: new MockAuctionClient(),
    walletClient: new MockWalletClient(),
  };
}
