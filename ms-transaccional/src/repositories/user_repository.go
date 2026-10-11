package repositories

import (
	"context"
	"database/sql"
	"ms-transaccional/src/models"
	"strconv"
	"time"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) CreateUserWithWallet(ctx context.Context, name, email, passwordHash string) (*models.User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var id int
	var createdAt time.Time
	err = tx.QueryRowContext(ctx, "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, created_at", name, email, passwordHash).Scan(&id, &createdAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO wallets (user_id, balance_available, balance_reserved) VALUES ($1, 0, 0)", id)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return &models.User{
		ID:        strconv.Itoa(id),
		Name:      name,
		Email:     email,
		Role:      "comprador",
		Status:    "activa",
		CreatedAt: createdAt,
	}, nil
}

func (r *UserRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	var u models.User
	var uID int
	err := r.db.QueryRowContext(ctx, "SELECT id, name, email, role, status, created_at FROM users WHERE id = $1", id).Scan(&uID, &u.Name, &u.Email, &u.Role, &u.Status, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	u.ID = strconv.Itoa(uID)
	return &u, nil
}

func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, string, error) {
	var u models.User
	var uID int
	var hash string
	err := r.db.QueryRowContext(ctx, "SELECT id, name, email, role, status, password_hash, created_at FROM users WHERE email = $1", email).Scan(&uID, &u.Name, &u.Email, &u.Role, &u.Status, &hash, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, "", ErrNotFound
		}
		return nil, "", err
	}
	u.ID = strconv.Itoa(uID)
	return &u, hash, nil
}

func (r *UserRepository) UpdateUser(ctx context.Context, id int, name, email *string) (*models.User, error) {
	var current models.User
	var cID int
	err := r.db.QueryRowContext(ctx, "SELECT id, name, email, role, status, created_at FROM users WHERE id = $1", id).Scan(&cID, &current.Name, &current.Email, &current.Role, &current.Status, &current.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}

	if name != nil {
		current.Name = *name
	}
	if email != nil {
		current.Email = *email
	}

	_, err = r.db.ExecContext(ctx, "UPDATE users SET name = $1, email = $2 WHERE id = $3", current.Name, current.Email, id)
	if err != nil {
		return nil, err
	}
	
	current.ID = strconv.Itoa(cID)
	return &current, nil
}

func (r *UserRepository) DeleteUser(ctx context.Context, id int) error {
	res, err := r.db.ExecContext(ctx, "UPDATE users SET name = 'Usuario Eliminado', email = 'deleted_' || id || '@pujaz.com', status = 'inactiva', password_hash = '' WHERE id = $1", id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
