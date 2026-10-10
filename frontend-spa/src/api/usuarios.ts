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
