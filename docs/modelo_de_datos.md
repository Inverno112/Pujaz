# Modelo de Datos - Pujaz

Este documento define la estructura de persistencia del sistema, separada según el patrón *Database per Service*.

## PostgreSQL (Microservicio Transaccional)

El siguiente Diagrama Entidad-Relación define las tablas críticas del negocio, garantizando integridad referencial y transacciones ACID.

```mermaid
erDiagram
    USERS {
        serial id PK
        varchar(100) name "NOT NULL"
        varchar(100) email "UNIQUE NOT NULL"
        varchar(255) password_hash "NOT NULL"
        varchar(20) role "DEFAULT 'comprador'"
        varchar(20) status "DEFAULT 'activa'"
    }

    WALLETS {
        serial id PK
        int user_id FK "UNIQUE NOT NULL"
        decimal(12,2) balance_available "NOT NULL DEFAULT 0.00"
        decimal(12,2) balance_reserved "NOT NULL DEFAULT 0.00"
    }

    WALLET_MOVEMENTS {
        serial id PK
        int wallet_id FK "NOT NULL"
        decimal(12,2) amount "NOT NULL"
        varchar(20) type "NOT NULL"
        timestamp created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    AUCTIONS {
        serial id PK
        varchar(24) item_id "UNIQUE NOT NULL"
        varchar(20) status "DEFAULT 'abierta'"
        decimal(12,2) current_price "NOT NULL"
        timestamp ends_at "NOT NULL"
    }

    BIDS {
        serial id PK
        int auction_id FK "NOT NULL"
        int user_id FK "NOT NULL"
        decimal(12,2) amount "NOT NULL"
        timestamp created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    %% Relaciones y Cardinalidad
    USERS ||--|| WALLETS : "posee (1 a 1)"
    WALLETS ||--o{ WALLET_MOVEMENTS : "registra (1 a N)"
    USERS ||--o{ BIDS : "realiza (1 a N)"
    AUCTIONS ||--o{ BIDS : "recibe (1 a N)"
```