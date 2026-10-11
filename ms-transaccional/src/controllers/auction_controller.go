package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"ms-transaccional/src/models"
	"ms-transaccional/src/services"
	"strings"
)

type AuctionController struct {
	service *services.AuctionService
}

func NewAuctionController(service *services.AuctionService) *AuctionController {
	return &AuctionController{service: service}
}

func writeError(w http.ResponseWriter, statusCode int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(models.ApiError{Code: code, Message: message})
}

func (c *AuctionController) CreateAuction(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAuctionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}
	fmt.Printf("Parsed CreateAuctionRequest: %+v\n", req)

	auction, err := c.service.CreateAuction(r.Context(), req.ItemID, req.BasePrice, req.EndsAt)
	if err != nil {
		if err == services.ErrInvalidInput || strings.Contains(err.Error(), "BAD_USER_INPUT") {
			fmt.Println("Validation error in CreateAuction: BAD_USER_INPUT")
			writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid auction parameters")
			return
		}
		fmt.Println("500 ERROR:", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(auction)
}

func (c *AuctionController) GetAuction(w http.ResponseWriter, r *http.Request) {
	// Parse URL path, e.g. /auctions/12
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid URL")
		return
	}
	id := parts[2] // parts[0]="", parts[1]="auctions", parts[2]="12"

	auction, err := c.service.GetAuction(r.Context(), id)
	if err != nil {
		if err == services.ErrNotFound {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Auction not found")
			return
		}
		fmt.Println("500 ERROR:", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(auction)
}

func (c *AuctionController) PlaceBid(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	// /auctions/12/bids
	if len(parts) < 4 {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid URL")
		return
	}
	auctionIDStr := parts[2]

	var req models.PlaceBidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}

	resp, err := c.service.PlaceBid(r.Context(), auctionIDStr, req.UserID, req.Amount)
	if err != nil {
		switch err {
		case services.ErrNotFound:
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Auction not found")
		case services.ErrAuctionClosed:
			writeError(w, http.StatusConflict, "AUCTION_CLOSED", "Auction is closed")
		case services.ErrBidTooLow:
			writeError(w, http.StatusConflict, "BID_TOO_LOW", "Bid is too low")
		case services.ErrInsufficientFunds:
			writeError(w, http.StatusUnprocessableEntity, "INSUFFICIENT_FUNDS", "Insufficient funds")
		default:
			if err.Error() == "BAD_USER_INPUT" {
				writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid User ID")
			} else {
				fmt.Println("500 ERROR:", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
			}
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (c *AuctionController) ListAuctions(w http.ResponseWriter, r *http.Request) {
	itemIdsStr := r.URL.Query().Get("itemIds")
	idsStr := r.URL.Query().Get("ids")

	var auctions []models.Auction
	var err error

	if itemIdsStr != "" {
		itemIds := strings.Split(itemIdsStr, ",")
		auctions, err = c.service.GetAuctionsByItemIDs(r.Context(), itemIds)
	} else if idsStr != "" {
		ids := strings.Split(idsStr, ",")
		auctions, err = c.service.GetAuctionsByIDs(r.Context(), ids)
	} else {
		auctions = []models.Auction{}
	}

	if err != nil {
		fmt.Println("500 ERROR:", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(auctions)
}
