-- Revert current_price
UPDATE auctions
SET current_price = current_price / 1000
WHERE item_id IN (
    '60d5ec49f1b2c3d4e5f60001', '60d5ec49f1b2c3d4e5f60002', '60d5ec49f1b2c3d4e5f60003',
    '60d5ec49f1b2c3d4e5f60004', '60d5ec49f1b2c3d4e5f60005', '60d5ec49f1b2c3d4e5f60006',
    '60d5ec49f1b2c3d4e5f60007', '60d5ec49f1b2c3d4e5f60008', '60d5ec49f1b2c3d4e5f60009',
    '60d5ec49f1b2c3d4e5f60010'
);

-- Revert password hashes to dummy texts
UPDATE users SET password_hash = 'hash_secreto123' WHERE email = 'ana@correo.com';
UPDATE users SET password_hash = 'hash_password123' WHERE email = 'heider@correo.com';
UPDATE users SET password_hash = 'hash_seguridad99' WHERE email = 'cata@correo.com';
