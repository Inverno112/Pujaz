import type { ExecutionResult } from 'graphql';
import { createSchema, createYoga, type Plugin, type YogaServerInstance } from 'graphql-yoga';
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
    context: async ({ request }): Promise<GatewayContext> => ({
      userId: await getUserId(readBearerToken(request.headers.get('authorization'))),
    }),
    plugins: [useAllowedErrorCodes()],
  });
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
