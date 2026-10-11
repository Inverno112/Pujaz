package controllers_test

import (
	"bytes"
	"os"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ms-transaccional/src/controllers"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"ms-transaccional/src/routes"
	"ms-transaccional/src/services"

	_ "github.com/lib/pq"
)

const pgConnStr = "postgres://pujaz_user:pujaz_password@localhost:5432/pujaz_transaccional?sslmode=disable"

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("postgres", pgConnStr)
	if err != nil {
		t.Fatalf("Failed to open DB: %v", err)
	}
	// Limpiar tablas y crear datos de prueba
	schema, _ := os.ReadFile("/tmp/schema.sql")
	db.Exec(string(schema))

	_, _ = db.Exec("TRUNCATE TABLE bids, wallet_movements, wallets, auctions, users RESTART IDENTITY CASCADE")

	// 1. Users
	_, _ = db.Exec("INSERT INTO users (id, name, email, password_hash) VALUES (1, 'Ana', 'ana@c.com', 'xxx'), (2, 'Luis', 'luis@c.com', 'xxx')")
	// 2. Wallets
	_, _ = db.Exec("INSERT INTO wallets (user_id, balance_available, balance_reserved) VALUES (1, 500000.00, 0), (2, 500000.00, 0)")
	// 3. Auctions
	// Auction 1: Open, BasePrice 100000
	_, _ = db.Exec("INSERT INTO auctions (id, item_id, current_price, ends_at) VALUES (1, 'item1', 100000.00, $1)", time.Now().Add(24*time.Hour).UTC())
	// Auction 2: Closed
	_, _ = db.Exec("INSERT INTO auctions (id, item_id, current_price, ends_at) VALUES (2, 'item2', 100000.00, $1)", time.Now().Add(-24*time.Hour).UTC())
	
	return db
}

func TestAuctionEndpoints(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	repo := repositories.NewAuctionRepository(db)
	svc := services.NewAuctionService(repo)
	ctrl := controllers.NewAuctionController(svc)
	mux := http.NewServeMux()
	routes.SetupAuctionRoutes(mux, ctrl)

	server := httptest.NewServer(mux)
	defer server.Close()

	// ---- Test 1: Get Auction without bids ----
	t.Run("GetAuction_NoBids", func(t *testing.T) {
		res, err := http.Get(server.URL + "/auctions/1")
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != 200 {
			t.Errorf("Expected 200, got %d", res.StatusCode)
		}
		var a models.Auction
		json.NewDecoder(res.Body).Decode(&a)
		if a.WinningBid != nil {
			t.Errorf("Expected no winning bid")
		}
	})

	// ---- Test POST bids (Table Driven) ----
	tests := []struct {
		name       string
		auctionID  string
		reqBody    models.PlaceBidRequest
		wantStatus int
		wantCode   string
	}{
		{
			name:       "Puja Válida",
			auctionID:  "1",
			reqBody:    models.PlaceBidRequest{UserID: "1", Amount: 120000.0},
			wantStatus: http.StatusCreated,
			wantCode:   "",
		},
		{
			name:       "Puja Igual o Menor",
			auctionID:  "1",
			reqBody:    models.PlaceBidRequest{UserID: "2", Amount: 120000.0},
			wantStatus: http.StatusConflict,
			wantCode:   "BID_TOO_LOW",
		},
		{
			name:       "Subasta Cerrada",
			auctionID:  "2",
			reqBody:    models.PlaceBidRequest{UserID: "2", Amount: 150000.0},
			wantStatus: http.StatusConflict,
			wantCode:   "AUCTION_CLOSED",
		},
		{
			name:       "Subasta Inexistente",
			auctionID:  "999",
			reqBody:    models.PlaceBidRequest{UserID: "1", Amount: 100000.0},
			wantStatus: http.StatusNotFound,
			wantCode:   "NOT_FOUND",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.reqBody)
			res, err := http.Post(server.URL+"/auctions/"+tc.auctionID+"/bids", "application/json", bytes.NewReader(b))
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != tc.wantStatus {
				t.Errorf("Expected status %d, got %d", tc.wantStatus, res.StatusCode)
			}
			if tc.wantCode != "" {
				var apiErr models.ApiError
				json.NewDecoder(res.Body).Decode(&apiErr)
				if apiErr.Code != tc.wantCode {
					t.Errorf("Expected error code %s, got %s", tc.wantCode, apiErr.Code)
				}
			}
		})
	}

	// ---- Test 2: Get Auction WITH bids ----
	t.Run("GetAuction_WithBids", func(t *testing.T) {
		res, err := http.Get(server.URL + "/auctions/1")
		if err != nil {
			t.Fatal(err)
		}
		var a models.Auction
		json.NewDecoder(res.Body).Decode(&a)
		if a.WinningBid == nil || a.WinningBid.Amount != 120000.0 {
			t.Errorf("Expected winning bid of 120000, got %v", a.WinningBid)
		}
		if len(a.Participants) != 1 {
			t.Errorf("Expected 1 participant, got %d", len(a.Participants))
		}
	})

	// ---- Test 3: Reintegro al ser superado ----
	t.Run("Reintegro_Al_Ser_Superado", func(t *testing.T) {
		// User 2 pujan sobre User 1 (que habia pujado 120,000 en el caso de exito anterior)
		req := models.PlaceBidRequest{UserID: "2", Amount: 130000.0}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/auctions/1/bids", "application/json", bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusCreated {
			t.Errorf("Expected 201, got %d", res.StatusCode)
		}

		// Validamos que user 1 recupero su dinero
		var avail1, res1 float64
		db.QueryRow("SELECT balance_available, balance_reserved FROM wallets WHERE user_id = 1").Scan(&avail1, &res1)
		
		if res1 != 0.0 {
			t.Errorf("Expected user 1 reserved to be 0, got %v", res1)
		}
		if avail1 != 500000.0 {
			t.Errorf("Expected user 1 available to be 500000, got %v", avail1)
		}

		// Validamos que user 2 ahora tiene reserva
		var avail2, res2 float64
		db.QueryRow("SELECT balance_available, balance_reserved FROM wallets WHERE user_id = 2").Scan(&avail2, &res2)
		if res2 != 130000.0 {
			t.Errorf("Expected user 2 reserved to be 130000, got %v", res2)
		}
		if avail2 != (500000.0 - 130000.0) {
			t.Errorf("Expected user 2 available to be 370000, got %v", avail2)
		}
	})
	
	// Test Insufficient Funds
	t.Run("Fondos_Insuficientes", func(t *testing.T) {
		req := models.PlaceBidRequest{UserID: "1", Amount: 9999999.0}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/auctions/1/bids", "application/json", bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("Expected 422, got %d", res.StatusCode)
		}
	})
}
