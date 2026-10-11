package controllers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ms-transaccional/src/controllers"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"ms-transaccional/src/routes"
	"ms-transaccional/src/services"

	_ "github.com/lib/pq"
)

func TestWalletEndpoints(t *testing.T) {
	db := setupTestDB(t) // Reuse the one from auction_test.go
	defer db.Close()

	repo := repositories.NewWalletRepository(db)
	svc := services.NewWalletService(repo)
	ctrl := controllers.NewWalletController(svc)
	mux := http.NewServeMux()
	routes.SetupWalletRoutes(mux, ctrl)

	server := httptest.NewServer(mux)
	defer server.Close()

	t.Run("Get Wallet Exitoso", func(t *testing.T) {
		res, err := http.Get(server.URL + "/users/1/wallet")
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != 200 {
			t.Errorf("Expected 200, got %d", res.StatusCode)
		}
		var w models.WalletResponse
		json.NewDecoder(res.Body).Decode(&w)
		if w.Available != 500000.0 {
			t.Errorf("Expected 500000.0, got %v", w.Available)
		}
	})

	t.Run("Recarga Válida", func(t *testing.T) {
		req := models.DepositRequest{Amount: 50000.0}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/users/1/wallet/deposits", "application/json", bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != 200 {
			t.Errorf("Expected 200, got %d", res.StatusCode)
		}
		var w models.WalletResponse
		json.NewDecoder(res.Body).Decode(&w)
		if w.Available != 550000.0 {
			t.Errorf("Expected 550000.0, got %v", w.Available)
		}
		if len(w.Movements) == 0 {
			t.Errorf("Expected movements to be updated")
		} else if w.Movements[0].Type != "DEPOSIT" {
			t.Errorf("Expected movement type DEPOSIT, got %s", w.Movements[0].Type)
		}
	})

	t.Run("Recarga Inválida", func(t *testing.T) {
		req := models.DepositRequest{Amount: -100.0}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/users/1/wallet/deposits", "application/json", bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400, got %d", res.StatusCode)
		}
	})
}
