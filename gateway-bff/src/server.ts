import type { Server } from 'node:http';
import type { ExecutionArgs, ExecutionResult } from 'graphql';
import { useServer } from 'graphql-ws/use/ws';
import { createSchema, createYoga, type Plugin, type YogaServerInstance } from 'graphql-yoga';
import { WebSocketServer } from 'ws';
import type { GatewayContext } from './core/context.js';
import { maskError, toAllowedError } from './core/errors.js';

type GatewayResolvers = NonNullable<Parameters<typeof createSchema<GatewayContext>>[0]['resolvers']>;

// Recibe el token (sin "Bearer ") y devuelve el userId, o null si no hay token o no es válido.
export type GetUserId = (token: string | null) => Promise<string | null>;

export interface GatewayOptions {
  typeDefs: string;
  resolvers: GatewayResolvers;
  corsOrigin: string;
  getUserId: GetUserId;
}

export function createGateway({
  typeDefs,
  resolvers,
  corsOrigin,
  getUserId,
}: GatewayOptions): YogaServerInstance<object, GatewayContext> {
  return createYoga<object, GatewayContext>({
    schema: createSchema<GatewayContext>({ typeDefs, resolvers }),
    maskedErrors: { maskError },
    cors: { origin: corsOrigin },
    // Por WebSocket no llega una petición HTTP: las suscripciones son públicas y van sin usuario.
    context: async ({ request }: { request?: Request }): Promise<GatewayContext> => ({
      userId: request ? await getUserId(readBearerToken(request.headers.get('authorization'))) : null,
    }),
    plugins: [useAllowedErrorCodes()],
  });
}

type GatewayYoga = YogaServerInstance<object, GatewayContext>;

// Lo que graphql-ws acepta como resultado de ejecutar una operación.
type OperationResult =
  | Promise<AsyncIterable<ExecutionResult> | ExecutionResult>
  | AsyncIterable<ExecutionResult>
  | ExecutionResult;

// Yoga entrega su execute y subscribe en rootValue para que graphql-ws los use.
interface EnvelopedRoot {
  execute: (args: ExecutionArgs) => OperationResult;
  subscribe: (args: ExecutionArgs) => OperationResult;
}

// Suscripciones por WebSocket con el protocolo graphql-ws, en la misma ruta /graphql. Usa el
// mismo pipeline de Yoga (schema, contexto y enmascarado de errores) que las peticiones HTTP.
export function attachWebSocket(httpServer: Server, yoga: GatewayYoga): WebSocketServer {
  const wsServer = new WebSocketServer({ server: httpServer, path: yoga.graphqlEndpoint });
  useServer(
    {
      execute: (args) => (args.rootValue as EnvelopedRoot).execute(args),
      subscribe: (args) => (args.rootValue as EnvelopedRoot).subscribe(args),
      onSubscribe: async (ctx, _id, params) => {
        const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
          ...ctx,
          req: ctx.extra.request,
          socket: ctx.extra.socket,
          params,
        });
        const args = {
          schema,
          operationName: params.operationName,
          document: parse(params.query),
          variableValues: params.variables,
          contextValue: await contextFactory(),
          rootValue: { execute, subscribe },
        };
        const errors = validate(args.schema, args.document);
        if (errors.length) return errors;
        return args;
      },
    },
    wsServer,
  );
  return wsServer;
}

function readBearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

// Los errores de validación de la consulta no pasan por maskError; aquí se traducen.
function useAllowedErrorCodes(): Plugin {
  const normalize = <T extends ExecutionResult>(result: T): T =>
    result.errors ? { ...result, errors: result.errors.map(toAllowedError) } : result;

  return {
    onResultProcess({ result, setResult }) {
      if (Symbol.asyncIterator in result) return;
      setResult(Array.isArray(result) ? result.map(normalize) : normalize(result));
    },
  };
}
