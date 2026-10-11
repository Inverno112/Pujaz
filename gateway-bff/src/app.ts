import { readFileSync } from 'node:fs';
import { ConfigError, SCHEMA_PATH, type Config } from './config.js';
import { HttpAuctionClient } from './infrastructure/clients/http/auction.http.js';
import { HttpItemClient } from './infrastructure/clients/http/item.http.js';
import { HttpUserClient } from './infrastructure/clients/http/user.http.js';
import { HttpWalletClient } from './infrastructure/clients/http/wallet.http.js';
import { MockAuctionClient } from './infrastructure/clients/mock/auction.mock.js';
import { MockItemClient } from './infrastructure/clients/mock/item.mock.js';
import { MockUserClient } from './infrastructure/clients/mock/user.mock.js';
import { MockWalletClient } from './infrastructure/clients/mock/wallet.mock.js';
import { HttpClient } from './infrastructure/http/http-client.js';
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
export function buildGateway(config: Config, clients: Clients = createClients(config)) {
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

// USE_MOCKS decide qué implementación se inyecta; los servicios no notan la diferencia.
export function createClients(config: Config): Clients {
  return config.useMocks ? createMockClients() : createHttpClients(config);
}

export function createHttpClients(config: Config): Clients {
  if (!config.msTransaccionalUrl || !config.msCatalogoUrl) {
    throw new ConfigError('Faltan MS_TRANSACCIONAL_URL y MS_CATALOGO_URL para usar los MS reales.');
  }
  const transaccional = new HttpClient('MS transaccional', config.msTransaccionalUrl);
  const catalogo = new HttpClient('MS catálogo', config.msCatalogoUrl);
  return {
    userClient: new HttpUserClient(transaccional),
    itemClient: new HttpItemClient(catalogo),
    auctionClient: new HttpAuctionClient(transaccional),
    walletClient: new HttpWalletClient(transaccional),
  };
}

export function createMockClients(): Clients {
  return {
    userClient: new MockUserClient(),
    itemClient: new MockItemClient(),
    auctionClient: new MockAuctionClient(),
    walletClient: new MockWalletClient(),
  };
}
