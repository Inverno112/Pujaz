ALTER TABLE wallet_movements ADD COLUMN auction_id INT REFERENCES auctions(id) NULL;
