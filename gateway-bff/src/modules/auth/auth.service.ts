import { AppError } from '../../core/errors.js';
import type { Credentials, NewUser, User, UserClient } from '../users/index.js';
import type { TokenService } from './token.service.js';

export interface AuthPayload {
  token: string;
  user: User;
}

export class AuthService {
  constructor(
    private readonly userClient: UserClient,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: NewUser): Promise<AuthPayload> {
    const user = await this.userClient.createUser(input);
    return { token: await this.tokenService.sign(user.id), user };
  }

  async login(credentials: Credentials): Promise<AuthPayload> {
    const user = await this.userClient.verifyCredentials(credentials);
    return { token: await this.tokenService.sign(user.id), user };
  }

  // userId del token, o null si el token no es válido o el usuario ya no existe (fue eliminado):
  // un JWT bien firmado no basta. Si el MS falla por otra causa se confía en el token, para no
  // cerrar la sesión ni romper las consultas públicas; las protegidas fallarán contra el mismo MS.
  async resolveUserId(token: string): Promise<string | null> {
    let userId: string;
    try {
      userId = (await this.tokenService.verify(token)).userId;
    } catch {
      return null;
    }
    try {
      await this.userClient.getUser(userId);
    } catch (error) {
      if (error instanceof AppError && error.code === 'NOT_FOUND') return null;
    }
    return userId;
  }
}
