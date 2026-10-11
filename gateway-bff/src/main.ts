import { createServer } from 'node:http';
import { buildGateway } from './app.js';
import { ConfigError, loadConfig, type Config } from './config.js';

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

// Los clientes HTTP llegan en la etapa 6.
if (!config.useMocks) {
  fail('los clientes HTTP hacia los MS aún no existen (etapa 6). Arranca con USE_MOCKS=true.');
}

const { yoga } = buildGateway(config);

createServer(yoga).listen(config.port, () => {
  console.info(`[gateway] escuchando en http://localhost:${config.port}${yoga.graphqlEndpoint}`);
});
