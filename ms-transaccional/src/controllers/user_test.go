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
		req := models.CreateUserRequest{Name: "Carlos", Email: "carlos@c.com", Password: "Password123"}
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
		req := models.CreateUserRequest{Name: "Copia", Email: "carlos@c.com", Password: "Password123"}
		b, _ := json.Marshal(req)
		res, _ := http.Post(server.URL+"/users", "application/json", bytes.NewReader(b))
		if res.StatusCode != 409 {
			t.Errorf("Expected 409 Conflict, got %d", res.StatusCode)
		}
	})

	// 3. Credenciales Correctas
	t.Run("Credenciales_Correctas", func(t *testing.T) {
		req := models.VerifyCredentialsRequest{Email: "carlos@c.com", Password: "Password123"}
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

	// 6. Usuario Eliminado: el borrado es lógico, pero para la API ya no existe
	t.Run("Usuario_Eliminado", func(t *testing.T) {
		req := models.CreateUserRequest{Name: "Borrar", Email: "borrar@c.com", Password: "Password123"}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/users", "application/json", bytes.NewReader(b))
		if err != nil { t.Fatal(err) }
		var user models.User
		json.NewDecoder(res.Body).Decode(&user)

		send := func(method, body string) int {
			r, _ := http.NewRequest(method, server.URL+"/users/"+user.ID, bytes.NewReader([]byte(body)))
			r.Header.Set("Content-Type", "application/json")
			resp, err := http.DefaultClient.Do(r)
			if err != nil { t.Fatal(err) }
			return resp.StatusCode
		}

		if code := send(http.MethodDelete, ""); code != 204 {
			t.Fatalf("Expected 204 on delete, got %d", code)
		}
		if code := send(http.MethodGet, ""); code != 404 {
			t.Errorf("Expected 404 on get after delete, got %d", code)
		}
		if code := send(http.MethodPatch, `{"name":"Otro"}`); code != 404 {
			t.Errorf("Expected 404 on patch after delete, got %d", code)
		}
		if code := send(http.MethodDelete, ""); code != 404 {
			t.Errorf("Expected 404 on second delete, got %d", code)
		}
	})

	// 7. Cambio de Contraseña: la nueva entra, la vieja no
	t.Run("Cambio_Password", func(t *testing.T) {
		req := models.CreateUserRequest{Name: "Clave", Email: "clave@c.com", Password: "Password123"}
		b, _ := json.Marshal(req)
		res, err := http.Post(server.URL+"/users", "application/json", bytes.NewReader(b))
		if err != nil { t.Fatal(err) }
		var user models.User
		json.NewDecoder(res.Body).Decode(&user)

		patch := func(body string) int {
			r, _ := http.NewRequest(http.MethodPatch, server.URL+"/users/"+user.ID, bytes.NewReader([]byte(body)))
			r.Header.Set("Content-Type", "application/json")
			resp, err := http.DefaultClient.Do(r)
			if err != nil { t.Fatal(err) }
			return resp.StatusCode
		}
		login := func(password string) int {
			b, _ := json.Marshal(models.VerifyCredentialsRequest{Email: "clave@c.com", Password: password})
			resp, err := http.Post(server.URL+"/users/verify-credentials", "application/json", bytes.NewReader(b))
			if err != nil { t.Fatal(err) }
			return resp.StatusCode
		}

		if code := patch(`{"password":"Nueva5678"}`); code != 200 {
			t.Fatalf("Expected 200 on password change, got %d", code)
		}
		if code := login("Nueva5678"); code != 200 {
			t.Errorf("Expected 200 with new password, got %d", code)
		}
		if code := login("Password123"); code != 401 {
			t.Errorf("Expected 401 with old password, got %d", code)
		}
		if code := patch(`{"password":"abc"}`); code != 400 {
			t.Errorf("Expected 400 on weak password, got %d", code)
		}
	})
}
