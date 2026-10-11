// Valida que las respuestas de los MS traigan todo lo que exige rest.md. Si falta algo obligatorio,
// la respuesta no se usa: no se inventan datos. Cada función devuelve solo los campos del contrato,
// así lo que el MS agregue de más no llega a la SPA.
import type { Auction, AuctionStatus, Bid, UserSummary } from '../../modules/auctions/index.js';
import type { Item } from '../../modules/catalog/index.js';
import type { User } from '../../modules/users/index.js';
import type { MovementType, Wallet, WalletMovement } from '../../modules/wallet/index.js';

export class ContractError extends Error {
  override name = 'ContractError';
}

type Json = Record<string, unknown>;

function object(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractError(`${where} no es un objeto`);
  }
  return value as Json;
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ContractError(`${where} no es una lista`);
  }
  return value;
}

function field(json: Json, key: string, where: string): unknown {
  if (!(key in json)) {
    throw new ContractError(`falta ${where}.${key}`);
  }
  return json[key];
}

function string(json: Json, key: string, where: string): string {
  const value = field(json, key, where);
  if (typeof value !== 'string') throw new ContractError(`${where}.${key} no es texto`);
  return value;
}

function nullableString(json: Json, key: string, where: string): string | null {
  const value = field(json, key, where);
  if (value !== null && typeof value !== 'string') throw new ContractError(`${where}.${key} no es texto ni null`);
  return value;
}

function number(json: Json, key: string, where: string): number {
  const value = field(json, key, where);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ContractError(`${where}.${key} no es un número`);
  return value;
}

function stringList(json: Json, key: string, where: string): string[] {
  const value = list(field(json, key, where), `${where}.${key}`);
  if (!value.every((entry) => typeof entry === 'string')) throw new ContractError(`${where}.${key} no es una lista de texto`);
  return value as string[];
}

function oneOf<T extends string>(json: Json, key: string, allowed: readonly T[], where: string): T {
  const value = string(json, key, where);
  if (!allowed.includes(value as T)) throw new ContractError(`${where}.${key} = "${value}" no es ${allowed.join(' | ')}`);
  return value as T;
}

// rest.md §1 · User
export function parseUser(value: unknown): User {
  const json = object(value, 'User');
  return {
    id: string(json, 'id', 'User'),
    name: string(json, 'name', 'User'),
    email: string(json, 'email', 'User'),
    createdAt: string(json, 'createdAt', 'User'),
  };
}

// rest.md §1 · UserSummary
function parseUserSummary(value: unknown, where: string): UserSummary {
  const json = object(value, where);
  return { id: string(json, 'id', where), name: string(json, 'name', where) };
}

function parseBid(value: unknown): Bid {
  const json = object(value, 'Bid');
  return {
    id: string(json, 'id', 'Bid'),
    amount: number(json, 'amount', 'Bid'),
    bidder: parseUserSummary(field(json, 'bidder', 'Bid'), 'Bid.bidder'),
    createdAt: string(json, 'createdAt', 'Bid'),
  };
}

const AUCTION_STATUSES: readonly AuctionStatus[] = ['OPEN', 'CLOSED'];

// rest.md §1 · Auction
export function parseAuction(value: unknown): Auction {
  const json = object(value, 'Auction');
  const winningBid = field(json, 'winningBid', 'Auction');
  return {
    id: string(json, 'id', 'Auction'),
    itemId: string(json, 'itemId', 'Auction'),
    basePrice: number(json, 'basePrice', 'Auction'),
    currentPrice: number(json, 'currentPrice', 'Auction'),
    winningBid: winningBid === null ? null : parseBid(winningBid),
    participants: list(field(json, 'participants', 'Auction'), 'Auction.participants').map((participant) =>
      parseUserSummary(participant, 'Auction.participants[]'),
    ),
    endsAt: string(json, 'endsAt', 'Auction'),
    status: oneOf(json, 'status', AUCTION_STATUSES, 'Auction'),
  };
}

const MOVEMENT_TYPES: readonly MovementType[] = ['DEPOSIT', 'RESERVE', 'REFUND'];

function parseMovement(value: unknown): WalletMovement {
  const json = object(value, 'WalletMovement');
  return {
    id: string(json, 'id', 'WalletMovement'),
    type: oneOf(json, 'type', MOVEMENT_TYPES, 'WalletMovement'),
    amount: number(json, 'amount', 'WalletMovement'),
    auctionId: nullableString(json, 'auctionId', 'WalletMovement'),
    createdAt: string(json, 'createdAt', 'WalletMovement'),
  };
}

// rest.md §1.2 · Wallet
export function parseWallet(value: unknown): Wallet {
  const json = object(value, 'Wallet');
  return {
    userId: string(json, 'userId', 'Wallet'),
    available: number(json, 'available', 'Wallet'),
    reserved: number(json, 'reserved', 'Wallet'),
    movements: list(field(json, 'movements', 'Wallet'), 'Wallet.movements').map(parseMovement),
  };
}

// rest.md §2 · Item
export function parseItem(value: unknown): Item {
  const json = object(value, 'Item');
  return {
    id: string(json, 'id', 'Item'),
    name: string(json, 'name', 'Item'),
    description: nullableString(json, 'description', 'Item'),
    category: nullableString(json, 'category', 'Item'),
    images: stringList(json, 'images', 'Item'),
    documents: stringList(json, 'documents', 'Item'),
    basePrice: number(json, 'basePrice', 'Item'),
  };
}

// Para las consultas en lote: la respuesta es una lista y solo trae lo pedido.
export function parseListOf<T>(parse: (value: unknown) => T, keyOf: (entry: T) => string, requested: string[]) {
  return (value: unknown): T[] => {
    const entries = list(value, 'la respuesta').map(parse);
    const unexpected = entries.map(keyOf).filter((key) => !requested.includes(key));
    if (unexpected.length > 0) {
      throw new ContractError(`la respuesta trae ids no pedidos (${unexpected.slice(0, 3).join(', ')}): el filtro no se aplicó`);
    }
    return entries;
  };
}

export function parseList<T>(parse: (value: unknown) => T) {
  return (value: unknown): T[] => list(value, 'la respuesta').map(parse);
}
