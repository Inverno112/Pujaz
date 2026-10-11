import { AppError, ERROR_CODES, type ErrorCode } from '../../core/errors.js';
import { ContractError } from './contract.js';

const DEFAULT_TIMEOUT_MS = 5000;
const INTERNAL_MESSAGE = 'Error interno del servidor.';

export interface HttpClientOptions {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// Habla JSON con un MS y traduce sus respuestas a lo que espera el Gateway:
// - éxito: la respuesta pasa por `parse`, que valida el contrato (rest.md);
// - error { code, message } con un código permitido: AppError con ese código;
// - error con formato de FastAPI ({ detail }): 404 -> NOT_FOUND, 400/422 -> BAD_USER_INPUT;
// - cualquier otra cosa, MS caído o tiempo agotado: INTERNAL. La causa solo va al log.
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly name: string,
    baseUrl: string,
    options: HttpClientOptions = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  get<T>(path: string, parse: (body: unknown) => T): Promise<T> {
    return this.request('GET', path, undefined, parse);
  }

  post<T>(path: string, body: unknown, parse: (body: unknown) => T): Promise<T> {
    return this.request('POST', path, body, parse);
  }

  patch<T>(path: string, body: unknown, parse: (body: unknown) => T): Promise<T> {
    return this.request('PATCH', path, body, parse);
  }

  delete<T>(path: string, parse: (body: unknown) => T): Promise<T> {
    return this.request('DELETE', path, undefined, parse);
  }

  private async request<T>(method: Method, path: string, body: unknown, parse: (body: unknown) => T): Promise<T> {
    const where = `${this.name} ${method} ${path}`;
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        // El contrato no usa redirecciones: una redirección significa que la ruta no existe.
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw internal(where, error instanceof Error && error.name === 'TimeoutError'
        ? `sin respuesta en ${this.timeoutMs} ms`
        : `no responde (${describe(error)})`);
    }

    const text = await response.text();
    const json = parseJson(text);

    if (!response.ok) {
      throw toAppError(where, response.status, json, text);
    }
    try {
      return parse(response.status === 204 || text === '' ? undefined : json);
    } catch (error) {
      if (error instanceof ContractError) {
        throw internal(where, `${error.message} (contrato rest.md)`);
      }
      throw error;
    }
  }
}

function toAppError(where: string, status: number, json: unknown, text: string): AppError {
  if (isObject(json) && isErrorCode(json.code) && typeof json.message === 'string') {
    return new AppError(json.code, json.message);
  }
  if (isObject(json) && 'detail' in json) {
    if (status === 404) return new AppError('NOT_FOUND', 'El recurso no existe.');
    if (status === 400 || status === 422) return new AppError('BAD_USER_INPUT', 'Los datos enviados no son válidos.');
  }
  return internal(where, `respondió ${status}: ${text.slice(0, 200)}`);
}

function internal(where: string, cause: string): AppError {
  console.error(`[gateway] ${where}: ${cause}`);
  return new AppError('INTERNAL', INTERNAL_MESSAGE);
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCode(code: unknown): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode);
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: string } }).cause;
    return cause?.code ?? error.message;
  }
  return String(error);
}
