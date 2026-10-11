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
}
