package services

import (
	"context"
	"errors"
	"fmt"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"strconv"
	"strings"
	"time"
)

var (
	ErrAuctionClosed     = errors.New("AUCTION_CLOSED")
	ErrBidTooLow         = errors.New("BID_TOO_LOW")
	ErrInsufficientFunds = errors.New("INSUFFICIENT_FUNDS")
	ErrInvalidInput      = errors.New("BAD_USER_INPUT")
	ErrNotFound          = repositories.ErrNotFound
)

type AuctionService struct {
	repo *repositories.AuctionRepository
}

func NewAuctionService(repo *repositories.AuctionRepository) *AuctionService {
	return &AuctionService{repo: repo}
}

func (s *AuctionService) updateStatus(a *models.Auction) {
	if time.Now().UTC().After(a.EndsAt) {
		a.Status = "CLOSED"
	} else {
		a.Status = "OPEN"
	}
}

func (s *AuctionService) CreateAuction(ctx context.Context, itemID string, basePrice float64, endsAt time.Time) (*models.Auction, error) {
	if basePrice <= 0 {
		return nil, ErrInvalidInput
	}
	if time.Now().UTC().After(endsAt) {
		return nil, ErrInvalidInput
	}
	
	auction, err := s.repo.CreateAuction(ctx, itemID, basePrice, endsAt)
	if err != nil {
		fmt.Println("Repo error:", err)
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return nil, ErrInvalidInput
		}
		return nil, err
	}
	s.updateStatus(auction)
	return auction, nil
}

func (s *AuctionService) GetAuction(ctx context.Context, idStr string) (*models.Auction, error) {
	var auction *models.Auction
	var err error

	// Try to parse as int (auctionId)
	if idInt, errParse := strconv.Atoi(idStr); errParse == nil {
		auction, err = s.repo.GetAuctionByID(ctx, idInt)
		// If it's not found by ID, it might be an item ID that happens to be numeric, but MongoDB ObjectIDs are hex strings and not purely numeric mostly.
	} else {
		auction, err = s.repo.GetAuctionByItemID(ctx, idStr)
	}

	if err != nil {
		return nil, err
	}
	s.updateStatus(auction)
	return auction, nil
}

func (s *AuctionService) PlaceBid(ctx context.Context, auctionIDStr string, userIDStr string, amount float64) (*models.PlaceBidResponse, error) {
	auctionID, err := strconv.Atoi(auctionIDStr)
	if err != nil {
		return nil, ErrNotFound // if it's not int, auction doesn't exist by auctionID
	}
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		return nil, errors.New("BAD_USER_INPUT")
	}

	db := s.repo.DB()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1. Get auction for update
	auction, err := s.repo.GetAuctionForUpdate(ctx, tx, auctionID)
	if err != nil {
		return nil, err
	}
	s.updateStatus(auction)

	// 2. Check if CLOSED
	if auction.Status == "CLOSED" {
		return nil, ErrAuctionClosed
	}

	// 3. Check amount
	if amount <= auction.CurrentPrice {
		return nil, ErrBidTooLow
	}

	// 4. Get User Wallet
	wID, avail, res, err := s.repo.GetWalletForUpdate(ctx, tx, userID)
	if err != nil {
		return nil, err // ErrNotFound -> user not found
	}

	// Check if user already has a winning bid
	var prevReservedForThisUser float64 = 0
	var prevWinnerID int = 0
	if auction.WinningBid != nil {
		wUID, _ := strconv.Atoi(auction.WinningBid.Bidder.ID)
		if wUID == userID {
			prevReservedForThisUser = auction.WinningBid.Amount
		}
		prevWinnerID = wUID
	}

	if avail+prevReservedForThisUser < amount {
		return nil, ErrInsufficientFunds
	}

	// 5 & 6. Update Wallets and Add Movements
	if prevWinnerID != 0 {
		if prevWinnerID != userID {
			// Refund previous winner
			pwID, pwAvail, pwRes, err := s.repo.GetWalletForUpdate(ctx, tx, prevWinnerID)
			if err == nil {
				err = s.repo.UpdateWalletBalances(ctx, tx, pwID, pwAvail+auction.WinningBid.Amount, pwRes-auction.WinningBid.Amount)
				if err == nil {
					_ = s.repo.AddWalletMovement(ctx, tx, pwID, auction.WinningBid.Amount, "reintegro", &auctionID)
				}
			}
		} else {
			// User is outbidding themselves: record a refund movement for the old bid to balance the ledger visually
			_ = s.repo.AddWalletMovement(ctx, tx, wID, auction.WinningBid.Amount, "reintegro", &auctionID)
		}
	}

	// Update new winner
	err = s.repo.UpdateWalletBalances(ctx, tx, wID, avail-(amount-prevReservedForThisUser), res+(amount-prevReservedForThisUser))
	if err != nil {
		return nil, err
	}
	err = s.repo.AddWalletMovement(ctx, tx, wID, amount, "reserva por puja", &auctionID)
	if err != nil {
		return nil, err
	}

	// 7. Save Bid and Update Auction Price
	bid, err := s.repo.CreateBid(ctx, tx, auctionID, userID, amount)
	if err != nil {
		return nil, err
	}
	err = s.repo.UpdateAuctionPrice(ctx, tx, auctionID, amount)
	if err != nil {
		return nil, err
	}

	// Commit Tx
	if err = tx.Commit(); err != nil {
		return nil, err
	}

	// Fetch updated auction to return
	updatedAuction, err := s.repo.GetAuctionByID(ctx, auctionID)
	if err != nil {
		return nil, err
	}
	s.updateStatus(updatedAuction)

	return &models.PlaceBidResponse{
		Bid:     *bid,
		Auction: *updatedAuction,
	}, nil
}

func (s *AuctionService) GetAuctionsByItemIDs(ctx context.Context, itemIDs []string) ([]models.Auction, error) {
	auctions, err := s.repo.GetAuctionsByItemIDs(ctx, itemIDs)
	if err != nil {
		return nil, err
	}
	for i := range auctions {
		s.updateStatus(&auctions[i])
	}
	return auctions, nil
}

func (s *AuctionService) GetAuctionsByIDs(ctx context.Context, idsStr []string) ([]models.Auction, error) {
	var ids []int
	for _, idStr := range idsStr {
		if id, err := strconv.Atoi(idStr); err == nil {
			ids = append(ids, id)
		}
	}
	auctions, err := s.repo.GetAuctionsByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range auctions {
		s.updateStatus(&auctions[i])
	}
	return auctions, nil
}
