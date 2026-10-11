package repositories

import (
	"context"
	"database/sql"
	"ms-transaccional/src/models"
	"strconv"
)

type WalletRepository struct {
	db *sql.DB
}

func NewWalletRepository(db *sql.DB) *WalletRepository {
	return &WalletRepository{db: db}
}

// Map db movement types to contract types
func mapMovementType(dbType string) string {
	switch dbType {
	case "recarga":
		return "DEPOSIT"
	case "reserva por puja":
		return "RESERVE"
	case "reintegro":
		return "REFUND"
	case "cobro":
		return "CHARGE"
	default:
		return "UNKNOWN"
	}
}

func (r *WalletRepository) GetWalletByUserID(ctx context.Context, userID int) (*models.WalletResponse, error) {
	var wallet models.WalletResponse
	wallet.UserID = strconv.Itoa(userID)

	var wID int
	err := r.db.QueryRowContext(ctx, "SELECT id, balance_available, balance_reserved FROM wallets WHERE user_id = $1", userID).Scan(&wID, &wallet.Available, &wallet.Reserved)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Fetch movements
	// En el ledger actual "wallet_movements", tenemos amount, type, created_at, pero NO auction_id.
	// El contrato menciona "auctionId". Tenemos que ver si lo agregamos o si siempre es null.
	// Por ahora devolvemos null, ya que el esquema (expand_model) no agregó auction_id a wallet_movements.
	rows, err := r.db.QueryContext(ctx, "SELECT id, amount, type, created_at FROM wallet_movements WHERE wallet_id = $1 ORDER BY created_at DESC", wID)
	wallet.Movements = []models.WalletMovement{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var m models.WalletMovement
			var dbType string
			var mID int
			if err := rows.Scan(&mID, &m.Amount, &dbType, &m.CreatedAt); err == nil {
				m.ID = strconv.Itoa(mID)
				m.Type = mapMovementType(dbType)
				wallet.Movements = append(wallet.Movements, m)
			}
		}
	}

	return &wallet, nil
}

func (r *WalletRepository) Deposit(ctx context.Context, userID int, amount float64) (*models.WalletResponse, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var wID int
	var available, reserved float64
	err = tx.QueryRowContext(ctx, "SELECT id, balance_available, balance_reserved FROM wallets WHERE user_id = $1 FOR UPDATE", userID).Scan(&wID, &available, &reserved)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}

	newAvailable := available + amount
	_, err = tx.ExecContext(ctx, "UPDATE wallets SET balance_available = $1 WHERE id = $2", newAvailable, wID)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO wallet_movements (wallet_id, amount, type) VALUES ($1, $2, 'recarga')", wID, amount)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return r.GetWalletByUserID(ctx, userID)
}
