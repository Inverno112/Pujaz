package services

import (
	"context"
	"errors"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"strconv"
)

type WalletService struct {
	repo *repositories.WalletRepository
}

func NewWalletService(repo *repositories.WalletRepository) *WalletService {
	return &WalletService{repo: repo}
}

func (s *WalletService) GetWallet(ctx context.Context, userIDStr string) (*models.WalletResponse, error) {
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		return nil, errors.New("BAD_USER_INPUT")
	}
	return s.repo.GetWalletByUserID(ctx, userID)
}

func (s *WalletService) Deposit(ctx context.Context, userIDStr string, amount float64) (*models.WalletResponse, error) {
	if amount <= 0 {
		return nil, errors.New("BAD_USER_INPUT")
	}
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		return nil, errors.New("BAD_USER_INPUT")
	}
	return s.repo.Deposit(ctx, userID, amount)
}
