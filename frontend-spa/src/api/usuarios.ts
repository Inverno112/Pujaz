// Operaciones GraphQL de usuarios y sesión (contrato: login, me).
import { gql, type TypedDocumentNode } from '@apollo/client'

export interface Usuario {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface AuthPayload {
  token: string
  user: Usuario
}

export const ME: TypedDocumentNode<{ me: Usuario | null }, Record<string, never>> = gql`
  query Me {
    me {
      id
      name
      email
      createdAt
    }
  }
`

export const LOGIN: TypedDocumentNode<
  { login: AuthPayload },
  { email: string; password: string }
> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        name
        email
        createdAt
      }
    }
  }
`

export const REGISTER: TypedDocumentNode<
  { register: AuthPayload },
  { input: { name: string; email: string; password: string } }
> = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        name
        email
        createdAt
      }
    }
  }
`

// Solo se envían los campos que cambian (todos son opcionales en UpdateUserInput).
export const UPDATE_USER: TypedDocumentNode<
  { updateUser: Usuario },
  { input: { name?: string; email?: string; password?: string } }
> = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      name
      email
      createdAt
    }
  }
`

export const DELETE_USER: TypedDocumentNode<{ deleteUser: boolean }, Record<string, never>> = gql`
  mutation DeleteUser {
    deleteUser
  }
`
