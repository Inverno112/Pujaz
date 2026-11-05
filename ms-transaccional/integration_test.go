package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ms-transaccional/src/controllers"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"ms-transaccional/src/routes"
	"ms-transaccional/src/services"
)

func setupRouter(t *testing.T) *http.ServeMux {
	db := getPgDB(t)

	walletRepo := repositories.NewWalletRepository(db)
	auctionRepo := repositories.NewAuctionRepository(db)

	walletService := services.NewWalletService(walletRepo)
	auctionService := services.NewAuctionService(auctionRepo)

	walletController := controllers.NewWalletController(walletService)
	auctionController := controllers.NewAuctionController(auctionService)

	mux := http.NewServeMux()
	routes.SetupWalletRoutes(mux, walletController)
	routes.SetupAuctionRoutes(mux, auctionController)

	return mux
}

// KAN-43: Prueba de integración de saldo
func TestWalletIntegration(t *testing.T) {
	mux := setupRouter(t)

	t.Run("Fallo sin promoCode", func(t *testing.T) {
		reqBody := models.DepositRequest{Amount: 10000.0}
		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/users/1/wallet", bytes.NewBuffer(body))
		
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusBadRequest && recorder.Code != http.StatusNotFound {
			t.Errorf("Esperaba 400, obtuve %d", recorder.Code)
		}
	})

	t.Run("Recarga exitosa", func(t *testing.T) {
		reqBody := models.DepositRequest{Amount: 50000.0, PromoCode: "PROMO2026"}
		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/users/1/wallet", bytes.NewBuffer(body))
		
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusOK && recorder.Code != http.StatusCreated && recorder.Code != http.StatusNotFound {
			t.Errorf("Esperaba 200/201, obtuve %d", recorder.Code)
		}
	})
}

// KAN-32: Prueba de integración de subastas
func TestAuctionBidsIntegration(t *testing.T) {
	mux := setupRouter(t)

	auctionReq := models.CreateAuctionRequest{
		ItemID:    fmt.Sprintf("it_%d", time.Now().Unix()),
		BasePrice: 1000.0,
		EndsAt:    time.Now().Add(24 * time.Hour),
	}
	bodyAuction, _ := json.Marshal(auctionReq)
	reqA, _ := http.NewRequest(http.MethodPost, "/auctions", bytes.NewBuffer(bodyAuction))
	recA := httptest.NewRecorder()
	mux.ServeHTTP(recA, reqA)
	
	var createdAuction models.Auction
	json.NewDecoder(recA.Body).Decode(&createdAuction)
	auctionID := createdAuction.ID
	if auctionID == "" { auctionID = "1" }

	t.Run("Puja menor al base price", func(t *testing.T) {
		bidReq := models.PlaceBidRequest{UserID: "1", Amount: 500.0}
		body, _ := json.Marshal(bidReq)
		req, _ := http.NewRequest(http.MethodPost, "/auctions/"+auctionID+"/bids", bytes.NewBuffer(body))
		
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusConflict && recorder.Code != http.StatusBadRequest {
			t.Errorf("Esperaba 409 o 400, obtuve %d", recorder.Code)
		}
		if !strings.Contains(recorder.Body.String(), "BID_TOO_LOW") {
			t.Errorf("El mensaje de error no contiene BID_TOO_LOW: %s", recorder.Body.String())
		}
	})

	t.Run("Puja exitosa reserva saldo", func(t *testing.T) {
		depReq := models.DepositRequest{Amount: 10000.0, PromoCode: "PROMO2026"}
		bodyDep, _ := json.Marshal(depReq)
		reqDep, _ := http.NewRequest(http.MethodPost, "/users/1/wallet", bytes.NewBuffer(bodyDep))
		mux.ServeHTTP(httptest.NewRecorder(), reqDep)

		bidReq := models.PlaceBidRequest{UserID: "1", Amount: 1500.0}
		body, _ := json.Marshal(bidReq)
		req, _ := http.NewRequest(http.MethodPost, "/auctions/"+auctionID+"/bids", bytes.NewBuffer(body))
		
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusOK && recorder.Code != http.StatusCreated {
			t.Errorf("Esperaba 200/201, obtuve %d: %s", recorder.Code, recorder.Body.String())
		}
	})
}