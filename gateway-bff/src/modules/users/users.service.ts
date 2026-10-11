import type { User, UserChanges, UserClient } from './user.client.js';

// Lo que llega de GraphQL (UpdateUserInput): cada campo puede faltar o venir en null.
export interface UpdateUserInput {
  name?: string | null;
  email?: string | null;
  password?: string | null;
}

export class UsersService {
  constructor(private readonly userClient: UserClient) {}

  getMe(userId: string): Promise<User> {
    return this.userClient.getUser(userId);
  }

  // Al MS solo van los campos con valor: los tres son obligatorios en User, así que null
  // significa "no cambiar", igual que no enviarlo.
  updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    const changes: UserChanges = {};
    if (input.name != null) changes.name = input.name;
    if (input.email != null) changes.email = input.email;
    if (input.password != null) changes.password = input.password;
    return this.userClient.updateUser(userId, changes);
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.userClient.deleteUser(userId);
    return true;
  }
}
