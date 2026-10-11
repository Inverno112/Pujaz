import type { Credentials, NewUser } from '../users/index.js';
import type { AuthService } from './auth.service.js';

export function createAuthResolvers(authService: AuthService) {
  return {
    Mutation: {
      register: (_parent: unknown, args: { input: NewUser }) => authService.register(args.input),
      login: (_parent: unknown, args: Credentials) => authService.login(args),
    },
  };
}
