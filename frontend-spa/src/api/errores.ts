// Lee el código de error que manda el Gateway en errors[].extensions.code (ver el contrato).
import { CombinedGraphQLErrors } from '@apollo/client'

export type CodigoError =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'BID_TOO_LOW'
  | 'AUCTION_CLOSED'
  | 'INSUFFICIENT_FUNDS'
  | 'INTERNAL'

// Devuelve el código del primer error, o null si el error no vino del Gateway (por ejemplo, sin red).
export function codigoError(error: unknown): CodigoError | null {
  if (CombinedGraphQLErrors.is(error)) {
    const codigo = error.errors[0]?.extensions?.code
    return typeof codigo === 'string' ? (codigo as CodigoError) : null
  }
  return null
}

// Extrae el mensaje de error que manda el servidor, útil para mostrar al usuario.
export function mensajeErrorServidor(error: unknown): string {
  if (CombinedGraphQLErrors.is(error) && error.errors.length > 0) {
    return error.errors[0].message
  }
  return 'Ocurrió un error inesperado al conectar con el servidor.'
}
