import { GraphQLError } from 'graphql';

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'BAD_USER_INPUT',
  'NOT_FOUND',
  'BID_TOO_LOW',
  'AUCTION_CLOSED',
  'INSUFFICIENT_FUNDS',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  override name = 'AppError';

  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

const INTERNAL_MESSAGE = 'Error interno del servidor.';

// Códigos que pone Yoga cuando la consulta no se puede leer o no cumple el schema.
const REQUEST_ERROR_CODES = new Set(['GRAPHQL_PARSE_FAILED', 'GRAPHQL_VALIDATION_FAILED', 'BAD_REQUEST']);

// Se compara por nombre y no con instanceof: el Gateway y Yoga pueden cargar copias distintas
// de `graphql` (CJS y ESM), y entonces instanceof falla aunque el error sí sea un GraphQLError.
function isGraphQLError(error: unknown): error is GraphQLError {
  return error instanceof Error && error.name === 'GraphQLError';
}

function isErrorCode(code: unknown): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode);
}

// AppError conserva su código; los errores propios de GraphQL (sin causa) se traducen con
// toAllowedError; cualquier otra excepción es INTERNAL.
export function maskError(error: unknown): GraphQLError {
  const original = isGraphQLError(error) ? error.originalError : error;
  const path = isGraphQLError(error) ? error.path : undefined;
  if (isGraphQLError(error) && original === undefined) {
    return toAllowedError(error);
  }
  if (original instanceof AppError) {
    return new GraphQLError(original.message, { path, extensions: { code: original.code } });
  }
  return new GraphQLError(INTERNAL_MESSAGE, { path, extensions: { code: 'INTERNAL' } });
}

// Último filtro antes de responder: garantiza que todo error salga con un código permitido.
export function toAllowedError(error: GraphQLError): GraphQLError {
  const code = error.extensions.code;
  if (isErrorCode(code)) {
    return error;
  }
  if (typeof code === 'string' && REQUEST_ERROR_CODES.has(code)) {
    return new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT', http: error.extensions.http },
    });
  }
  return new GraphQLError(INTERNAL_MESSAGE, { path: error.path, extensions: { code: 'INTERNAL' } });
}
