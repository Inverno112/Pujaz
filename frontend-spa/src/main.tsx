// Punto de entrada: conecta el cliente GraphQL, la sesión y el enrutador con la aplicación.
import { ApolloProvider } from '@apollo/client/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { client } from './api/client'
import { App } from './App'
import './index.css'
import { SessionProvider } from './session/SessionProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </ApolloProvider>
  </StrictMode>,
)
