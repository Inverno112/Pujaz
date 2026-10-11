import { createServer } from 'node:http';
import { buildGateway } from './app.js';
import { ConfigError, loadConfig, type Config } from './config.js';
import { attachWebSocket } from './server.js';

function fail(message: string): never {
  console.error(`[gateway] configuración inválida: ${message}`);
  process.exit(1);
}

function readConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) fail(error.message);
    throw error;
  }
}

const config = readConfig();

const { yoga } = buildGateway(config);

const httpServer = createServer(yoga);
attachWebSocket(httpServer, yoga);

httpServer.listen(config.port, () => {
  const clients = config.useMocks
    ? 'clientes falsos (USE_MOCKS=true)'
    : `MS transaccional ${config.msTransaccionalUrl} y MS catálogo ${config.msCatalogoUrl}`;
  console.info(`[gateway] escuchando en http://localhost:${config.port}${yoga.graphqlEndpoint} con ${clients}`);
});
