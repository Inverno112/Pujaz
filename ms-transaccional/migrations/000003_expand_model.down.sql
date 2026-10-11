ALTER TABLE wallet_movements DROP CONSTRAINT IF EXISTS valid_movement_type;
ALTER TABLE wallet_movements DROP COLUMN IF EXISTS wallet_id;
ALTER TABLE wallet_movements ADD COLUMN user_id INT;

DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;