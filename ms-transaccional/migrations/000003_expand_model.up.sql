-- 1. tabla wallets
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id),
    balance_available DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance_reserved DECIMAL(12,2) NOT NULL DEFAULT 0.00
);

-- 2. tabla bids
CREATE TABLE IF NOT EXISTS bids (
    id SERIAL PRIMARY KEY,
    auction_id INT NOT NULL REFERENCES auctions(id),
    user_id INT NOT NULL REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. wallet_movements
TRUNCATE TABLE wallet_movements CASCADE;
ALTER TABLE wallet_movements DROP COLUMN IF EXISTS user_id;
ALTER TABLE wallet_movements ADD COLUMN wallet_id INT NOT NULL REFERENCES wallets(id);

-- 4. Asegurar tipos de movimiento
ALTER TABLE wallet_movements DROP CONSTRAINT IF EXISTS valid_movement_type;
ALTER TABLE wallet_movements ADD CONSTRAINT valid_movement_type 
    CHECK (type IN ('recarga', 'reserva por puja', 'reintegro', 'cobro'));