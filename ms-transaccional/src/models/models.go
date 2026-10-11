package models

import "time"

type ApiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type UserSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Bid struct {
	ID        string      `json:"id"`
	Amount    float64     `json:"amount"`
	Bidder    UserSummary `json:"bidder"`
	CreatedAt time.Time   `json:"createdAt"`
}

type Auction struct {
	ID           string        `json:"id"`
	ItemID       string        `json:"itemId"`
	BasePrice    float64       `json:"basePrice"`
	CurrentPrice float64       `json:"currentPrice"`
	WinningBid   *Bid          `json:"winningBid"`
	Participants []UserSummary `json:"participants"`
	EndsAt       time.Time     `json:"endsAt"`
	Status       string        `json:"status"`
}

type PlaceBidRequest struct {
	UserID string  `json:"userId"`
	Amount float64 `json:"amount"`
}

type PlaceBidResponse struct {
	Bid     Bid     `json:"bid"`
	Auction Auction `json:"auction"`
}

type WalletMovement struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // "DEPOSIT", "RESERVE", "REFUND"
	Amount    float64   `json:"amount"`
	AuctionID *string   `json:"auctionId"` // Puede ser null
	CreatedAt time.Time `json:"createdAt"`
}

type WalletResponse struct {
	UserID    string           `json:"userId"`
	Available float64          `json:"available"`
	Reserved  float64          `json:"reserved"`
	Movements []WalletMovement `json:"movements"`
}

type DepositRequest struct {
	Amount float64 `json:"amount"`
}

type User struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role,omitempty"`
	Status string `json:"status,omitempty"`
}

type CreateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateUserRequest struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
}

type VerifyCredentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
