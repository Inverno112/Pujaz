package controllers_test

import (
	"bytes"
	"database/sql"
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

func setupUserTestServer(t *testing.T) (*sql.DB, *httptest.Server) {
	db := setupTestDB(t) // reuse the db setup logic
	
	walletRepo := repositories.NewWalletRepository(db)
	walletSvc := services.NewWalletService(walletRepo)
	walletCtrl := controllers.NewWalletController(walletSvc)

	userRepo := repositories.NewUserRepository(db)
	userSvc := services.NewUserService(userRepo)
	userCtrl := controllers.NewUserController(userSvc)

	mux := http.NewServeMux()
	routes.SetupUserRoutes(mux, userCtrl, walletCtrl)

	return db, httptest.NewServer(mux)
}

func TestUserEndpoints(t *testing.T) {
	db, server := setupUserTestServer(t)
	defer db.Close()
	defer server.Close()

	// 1. Registro Válido
	db.Exec("DELETE FROM wallet_movements")
	db.Exec("DELETE FROM wallets")
	db.Exec("DELETE FROM bids")
	db.Exec("DELETE FROM auctions")
	db.Exec("DELETE FROM users")

	t.Run("Registro_Válido", func(t *testing.T) {
		req := models.CreateUserRequest{Name: "Carlos", Email: "carlos@c.com", Password: "password123"}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/users", "application/json", bytes.NewReader(b))
		if err != nil { t.Fatal(err) }
		if res.StatusCode != 201 {
			t.Errorf("Expected 201, got %d", res.StatusCode)
		}
		var user models.User
		json.NewDecoder(res.Body).Decode(&user)
		if user.Email != "carlos@c.com" {
			t.Errorf("Expected email carlos@c.com, got %v", user.Email)
		}
		
		// Verificamos que se creó su billetera (saldo disponible 0)
		resW, _ := http.Get(server.URL+"/users/" + user.ID + "/wallet")
		if resW.StatusCode != 200 {
			t.Errorf("Wallet was not created for new user")
		}
	})

	// 2. Email Repetido
	t.Run("Email_Repetido", func(t *testing.T) {
		req := models.CreateUserRequest{Name: "Copia", Email: "carlos@c.com", Password: "password123"}
		b, _ := json.Marshal(req)
		res, _ := http.Post(server.URL+"/users", "application/json", bytes.NewReader(b))
		if res.StatusCode != 409 {
			t.Errorf("Expected 409 Conflict, got %d", res.StatusCode)
		}
	})

	// 3. Credenciales Correctas
	t.Run("Credenciales_Correctas", func(t *testing.T) {
		req := models.VerifyCredentialsRequest{Email: "carlos@c.com", Password: "password123"}
		b, _ := json.Marshal(req)
		res, _ := http.Post(server.URL+"/users/verify-credentials", "application/json", bytes.NewReader(b))
		if res.StatusCode != 200 {
			t.Errorf("Expected 200, got %d", res.StatusCode)
		}
	})

	// 4. Credenciales Incorrectas
	t.Run("Credenciales_Incorrectas", func(t *testing.T) {
		req := models.VerifyCredentialsRequest{Email: "carlos@c.com", Password: "wrong"}
		b, _ := json.Marshal(req)
		res, _ := http.Post(server.URL+"/users/verify-credentials", "application/json", bytes.NewReader(b))
		if res.StatusCode != 401 {
			t.Errorf("Expected 401, got %d", res.StatusCode)
		}
	})

	// 5. Usuario Inexistente
	t.Run("Usuario_Inexistente", func(t *testing.T) {
		req := models.VerifyCredentialsRequest{Email: "ghost@c.com", Password: "wrong"}
		b, _ := json.Marshal(req)
		res, _ := http.Post(server.URL+"/users/verify-credentials", "application/json", bytes.NewReader(b))
		if res.StatusCode != 401 {
			t.Errorf("Expected 401 for non-existent user on verify, got %d", res.StatusCode)
		}

		resGet, _ := http.Get(server.URL+"/users/999")
		if resGet.StatusCode != 404 {
			t.Errorf("Expected 404 for non-existent user get, got %d", resGet.StatusCode)
		}
	})
}
