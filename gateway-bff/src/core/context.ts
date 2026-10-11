import { AppError } from './errors.js';

export interface GatewayContext {
  userId: string | null;
}

// Primera línea de todo resolver protegido.
export function requireUser(ctx: GatewayContext): string {
  if (ctx.userId === null) {
    throw new AppError('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }
  return ctx.userId;
}
