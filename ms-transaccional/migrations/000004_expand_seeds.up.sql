UPDATE users 
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' 
WHERE password_hash IS NULL OR password_hash = '';

-- wallets para los usuarios semilla
INSERT INTO wallets (user_id, balance_available, balance_reserved)
SELECT id, 50000.00, 0.00 FROM users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallet_movements (wallet_id, amount, type)
SELECT id, 50000.00, 'recarga' FROM wallets;