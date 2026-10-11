import { requireUser, type GatewayContext } from '../../core/context.js';
import type { UpdateUserInput, UsersService } from './users.service.js';

export function createUsersResolvers(usersService: UsersService) {
  return {
    Query: {
      me: (_parent: unknown, _args: unknown, ctx: GatewayContext) => usersService.getMe(requireUser(ctx)),
    },
    Mutation: {
      updateUser: (_parent: unknown, args: { input: UpdateUserInput }, ctx: GatewayContext) =>
        usersService.updateUser(requireUser(ctx), args.input),
      deleteUser: (_parent: unknown, _args: unknown, ctx: GatewayContext) => usersService.deleteUser(requireUser(ctx)),
    },
  };
}
