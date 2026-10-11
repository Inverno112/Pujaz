import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_PATH } from '../../src/config.js';
import { AppError } from '../../src/core/errors.js';
import { createGateway } from '../../src/server.js';

const typeDefs = readFileSync(SCHEMA_PATH, 'utf8');

const yoga = createGateway({
  typeDefs,
  corsOrigin: 'http://localhost:5173',
  getUserId: async () => null,
  // Resolvers solo para las pruebas: provocan los dos tipos de error.
  resolvers: {
    Query: {
      item: () => {
        throw new AppError('NOT_FOUND', 'El ítem no existe.');
      },
      items: () => {
        throw new Error('boom en /ruta/secreta/archivo.ts');
      },
    },
  },
});

async function graphql(body: unknown): Promise<{ status: number; text: string; json: any }> {
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) };
}

describe('servidor GraphQL', () => {
  it('responde { __typename } con el schema del contrato', async () => {
    const { json } = await graphql({ query: '{ __typename }' });
    expect(json).toEqual({ data: { __typename: 'Query' } });
  });

  it('AppError("NOT_FOUND") sale con extensions.code = NOT_FOUND', async () => {
    const { json } = await graphql({ query: '{ item(id: "1") { id } }' });
    expect(json.errors[0].extensions.code).toBe('NOT_FOUND');
    expect(json.errors[0].message).toBe('El ítem no existe.');
  });

  it('una excepción cualquiera sale como INTERNAL con mensaje genérico y sin detalles', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { json, text } = await graphql({ query: '{ items { id } }' });
    expect(json.errors[0].extensions).toEqual({ code: 'INTERNAL' });
    expect(json.errors[0].message).toBe('Error interno del servidor.');
    expect(text).not.toMatch(/boom|ruta|secreta|stack|\.ts/);
  });

  it('una consulta que no cumple el schema sale como BAD_USER_INPUT', async () => {
    const { json } = await graphql({ query: '{ campoQueNoExiste }' });
    expect(json.errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('una consulta mal escrita sale como BAD_USER_INPUT', async () => {
    const { json } = await graphql({ query: '{ items { ' });
    expect(json.errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });
});
