package repositories

import (
	"context"
	"github.com/lib/pq"
	"database/sql"
	"errors"
	"ms-transaccional/src/models"
	"strconv"
)

var ErrNotFound = errors.New("NOT_FOUND")

type AuctionRepository struct {
	db *sql.DB
}

func NewAuctionRepository(db *sql.DB) *AuctionRepository {
	return &AuctionRepository{db: db}
}

func (r *AuctionRepository) DB() *sql.DB {
	return r.db
}

func (r *AuctionRepository) getAuction(ctx context.Context, txOrDB interface {
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
}, auctionID int) (*models.Auction, error) {

	query := `SELECT id, item_id, current_price, ends_at FROM auctions WHERE id = $1`
	var auction models.Auction
	var aID int
	
	err := txOrDB.QueryRowContext(ctx, query, auctionID).Scan(&aID, &auction.ItemID, &auction.CurrentPrice, &auction.EndsAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	auction.ID = strconv.Itoa(aID)
	// BasePrice fallback
	auction.BasePrice = auction.CurrentPrice 

	// Get winning bid
	bidQuery := `
		SELECT b.id, b.amount, b.created_at, u.id, u.name 
		FROM bids b
		JOIN users u ON b.user_id = u.id
		WHERE b.auction_id = $1
		ORDER BY b.amount DESC, b.created_at ASC
		LIMIT 1
	`
	var bID, uID int
	var bid models.Bid
	err = txOrDB.QueryRowContext(ctx, bidQuery, auctionID).Scan(&bID, &bid.Amount, &bid.CreatedAt, &uID, &bid.Bidder.Name)
	if err == nil {
		bid.ID = strconv.Itoa(bID)
		bid.Bidder.ID = strconv.Itoa(uID)
		auction.WinningBid = &bid
	}

	// Get participants
	partQuery := `
		SELECT DISTINCT u.id, u.name 
		FROM bids b
		JOIN users u ON b.user_id = u.id
		WHERE b.auction_id = $1
	`
	rows, err := txOrDB.QueryContext(ctx, partQuery, auctionID)
	if err == nil {
		defer rows.Close()
		auction.Participants = []models.UserSummary{}
		for rows.Next() {
			var pUID int
			var pName string
			if err := rows.Scan(&pUID, &pName); err == nil {
				auction.Participants = append(auction.Participants, models.UserSummary{
					ID:   strconv.Itoa(pUID),
					Name: pName,
				})
			}
		}
	} else {
		auction.Participants = []models.UserSummary{}
	}

	return &auction, nil
}

func (r *AuctionRepository) GetAuctionByID(ctx context.Context, id int) (*models.Auction, error) {
	return r.getAuction(ctx, r.db, id)
}

func (r *AuctionRepository) GetAuctionByItemID(ctx context.Context, itemID string) (*models.Auction, error) {
	var aID int
	err := r.db.QueryRowContext(ctx, "SELECT id FROM auctions WHERE item_id = $1", itemID).Scan(&aID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.getAuction(ctx, r.db, aID)
}

func (r *AuctionRepository) GetAuctionForUpdate(ctx context.Context, tx *sql.Tx, auctionID int) (*models.Auction, error) {
	var aID int
	err := tx.QueryRowContext(ctx, "SELECT id FROM auctions WHERE id = $1 FOR UPDATE", auctionID).Scan(&aID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.getAuction(ctx, tx, aID)
}

func (r *AuctionRepository) UpdateAuctionPrice(ctx context.Context, tx *sql.Tx, auctionID int, newPrice float64) error {
	_, err := tx.ExecContext(ctx, "UPDATE auctions SET current_price = $1 WHERE id = $2", newPrice, auctionID)
	return err
}

func (r *AuctionRepository) CreateBid(ctx context.Context, tx *sql.Tx, auctionID int, userID int, amount float64) (*models.Bid, error) {
	var bidID int
	err := tx.QueryRowContext(ctx, "INSERT INTO bids (auction_id, user_id, amount) VALUES ($1, $2, $3) RETURNING id", auctionID, userID, amount).Scan(&bidID)
	if err != nil {
		return nil, err
	}
	// Fetch the full bid
	var bid models.Bid
	var uID int
	err = tx.QueryRowContext(ctx, `
		SELECT b.id, b.amount, b.created_at, u.id, u.name 
		FROM bids b JOIN users u ON b.user_id = u.id WHERE b.id = $1
	`, bidID).Scan(&bidID, &bid.Amount, &bid.CreatedAt, &uID, &bid.Bidder.Name)
	if err != nil {
		return nil, err
	}
	bid.ID = strconv.Itoa(bidID)
	bid.Bidder.ID = strconv.Itoa(uID)
	return &bid, nil
}

// Billetera methods for transaction
func (r *AuctionRepository) GetWalletForUpdate(ctx context.Context, tx *sql.Tx, userID int) (int, float64, float64, error) {
	var wID int
	var avail, res float64
	err := tx.QueryRowContext(ctx, "SELECT id, balance_available, balance_reserved FROM wallets WHERE user_id = $1 FOR UPDATE", userID).Scan(&wID, &avail, &res)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, 0, 0, ErrNotFound
		}
		return 0, 0, 0, err
	}
	return wID, avail, res, nil
}

func (r *AuctionRepository) UpdateWalletBalances(ctx context.Context, tx *sql.Tx, walletID int, available, reserved float64) error {
	_, err := tx.ExecContext(ctx, "UPDATE wallets SET balance_available = $1, balance_reserved = $2 WHERE id = $3", available, reserved, walletID)
	return err
}

func (r *AuctionRepository) AddWalletMovement(ctx context.Context, tx *sql.Tx, walletID int, amount float64, movType string) error {
	_, err := tx.ExecContext(ctx, "INSERT INTO wallet_movements (wallet_id, amount, type) VALUES ($1, $2, $3)", walletID, amount, movType)
	return err
}

func (r *AuctionRepository) GetAuctionsByItemIDs(ctx context.Context, itemIDs []string) ([]models.Auction, error) {
	if len(itemIDs) == 0 {
		return []models.Auction{}, nil
	}
	
	query := `SELECT id FROM auctions WHERE item_id = ANY($1)`
	rows, err := r.db.QueryContext(ctx, query, pq.Array(itemIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var auctions []models.Auction
	for rows.Next() {
		var aID int
		if err := rows.Scan(&aID); err == nil {
			a, err2 := r.getAuction(ctx, r.db, aID)
			if err2 == nil && a != nil {
				auctions = append(auctions, *a)
			}
		}
	}
	return auctions, nil
}

func (r *AuctionRepository) GetAuctionsByIDs(ctx context.Context, ids []int) ([]models.Auction, error) {
	if len(ids) == 0 {
		return []models.Auction{}, nil
	}
	
	var ids64 []int64
	for _, id := range ids {
		ids64 = append(ids64, int64(id))
	}

	query := `SELECT id FROM auctions WHERE id = ANY($1)`
	rows, err := r.db.QueryContext(ctx, query, pq.Array(ids64))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var auctions []models.Auction
	for rows.Next() {
		var aID int
		if err := rows.Scan(&aID); err == nil {
			a, err2 := r.getAuction(ctx, r.db, aID)
			if err2 == nil && a != nil {
				auctions = append(auctions, *a)
			}
		}
	}
	return auctions, nil
}
