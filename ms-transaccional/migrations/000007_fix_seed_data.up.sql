-- KAN-53: Fix password hashes for seed users (password for all: '12345678')
UPDATE users 
SET password_hash = '$2a$10$vKR3BfuHcEmHaGSLpFmiI.b.hlVWE7.I8oIumhCvr2Erm0PG.6gru'
WHERE email IN ('ana@correo.com', 'heider@correo.com', 'cata@correo.com');

-- KAN-53: Fix current_price in seed auctions to match MongoDB basePrice
UPDATE auctions
SET current_price = current_price * 1000
WHERE item_id IN (
    '60d5ec49f1b2c3d4e5f60001', '60d5ec49f1b2c3d4e5f60002', '60d5ec49f1b2c3d4e5f60003',
    '60d5ec49f1b2c3d4e5f60004', '60d5ec49f1b2c3d4e5f60005', '60d5ec49f1b2c3d4e5f60006',
    '60d5ec49f1b2c3d4e5f60007', '60d5ec49f1b2c3d4e5f60008', '60d5ec49f1b2c3d4e5f60009',
    '60d5ec49f1b2c3d4e5f60010'
);
