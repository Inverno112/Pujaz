import { AppError } from '../../../core/errors.js';

// Operaciones que el Gateway no implementa con los MS reales porque el contrato está incompleto:
// responden INTERNAL sin llamar al MS y el log dice por qué.
export function createNotAvailable(where: string, reason: string): AppError {
  console.error(`[gateway] ${where}: no disponible. ${reason}`);
  return new AppError('INTERNAL', 'Error interno del servidor.');
}

export const MISSING_CREATE_AUCTION =
  'POST /auctions no existe en el MS transaccional; crear el ítem sin su subasta lo dejaría huérfano (contrato rest.md §1.3).';
