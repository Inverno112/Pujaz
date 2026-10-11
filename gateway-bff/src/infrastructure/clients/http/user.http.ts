import { AppError } from '../../../core/errors.js';
import type { Credentials, NewUser, User, UserChanges, UserClient } from '../../../modules/users/index.js';
import { parseUser } from '../../http/contract.js';
import type { HttpClient } from '../../http/http-client.js';

// MS transaccional, rest.md §1.1.
export class HttpUserClient implements UserClient {
  constructor(private readonly http: HttpClient) {}

  createUser(input: NewUser): Promise<User> {
    return this.http.post('/users', input, parseUser);
  }

  verifyCredentials(input: Credentials): Promise<User> {
    return this.http.post('/users/verify-credentials', input, parseUser);
  }

  getUser(userId: string): Promise<User> {
    return this.http.get(`/users/${encodeURIComponent(userId)}`, parseActiveUser);
  }

  updateUser(userId: string, changes: UserChanges): Promise<User> {
    return this.http.patch(`/users/${encodeURIComponent(userId)}`, changes, parseUser);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.http.delete(`/users/${encodeURIComponent(userId)}`, () => undefined);
  }
}

// El MS no borra al usuario: lo anonimiza y lo marca con status "inactiva". Para el Gateway
// es lo mismo que el 404 del contrato.
function parseActiveUser(body: unknown): User {
  if (typeof body === 'object' && body !== null && (body as { status?: unknown }).status === 'inactiva') {
    throw new AppError('NOT_FOUND', 'El usuario no existe.');
  }
  return parseUser(body);
}
