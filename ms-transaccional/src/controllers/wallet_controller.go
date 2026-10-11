package controllers

import (
	"encoding/json"
	"net/http"
	"ms-transaccional/src/models"
	"ms-transaccional/src/services"
	"strings"
)

type WalletController struct {
	service *services.WalletService
}

func NewWalletController(service *services.WalletService) *WalletController {
	return &WalletController{service: service}
}

func (c *WalletController) HandleUsers(w http.ResponseWriter, r *http.Request) {
	// Paths: 
	// GET /users/{userId}/wallet
	// POST /users/{userId}/wallet/deposits
	parts := strings.Split(r.URL.Path, "/")
	// "" / "users" / "{id}" / "wallet" / ["deposits"]
	if len(parts) < 4 || parts[3] != "wallet" {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "Not found")
		return
	}

	userID := parts[2]

	if len(parts) == 4 && r.Method == http.MethodGet {
		c.GetWallet(w, r, userID)
		return
	}

	if len(parts) == 5 && parts[4] == "deposits" && r.Method == http.MethodPost {
		c.Deposit(w, r, userID)
		return
	}

	writeError(w, http.StatusNotFound, "NOT_FOUND", "Not found")
}

func (c *WalletController) GetWallet(w http.ResponseWriter, r *http.Request, userID string) {
	wallet, err := c.service.GetWallet(r.Context(), userID)
	if err != nil {
		if err == services.ErrNotFound {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Wallet not found")
			return
		}
		if err.Error() == "BAD_USER_INPUT" {
			writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid User ID")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallet)
}

func (c *WalletController) Deposit(w http.ResponseWriter, r *http.Request, userID string) {
	var req models.DepositRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}

	wallet, err := c.service.Deposit(r.Context(), userID, req.Amount)
	if err != nil {
		if err == services.ErrNotFound {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "Wallet not found")
			return
		}
		if err.Error() == "BAD_USER_INPUT" {
			writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid input")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallet)
}
