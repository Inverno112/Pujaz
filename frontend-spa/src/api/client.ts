// Cliente GraphQL: el único lugar donde se configura la conexión con el Gateway.
// - Queries y mutations van por HTTP a /graphql.
// - Las subscriptions (tiempo real) van por WebSocket a /graphql.
// - El JWT se agrega solo en cada petición HTTP.
import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { OperationTypeNode } from 'graphql'
import { createClient } from 'graphql-ws'
import { getToken } from './auth'

const httpLink = new HttpLink({ uri: '/graphql' })

const authLink = new SetContextLink((prevContext) => {
  const token = getToken()
  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
})

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
const wsLink = new GraphQLWsLink(
  createClient({ url: `${wsProtocol}://${window.location.host}/graphql` }),
)

// Si la operación es una subscription, va por WebSocket; si no, por HTTP con el JWT.
const link = ApolloLink.split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === OperationTypeNode.SUBSCRIPTION
    )
  },
  wsLink,
  authLink.concat(httpLink),
)

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
})
