package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	
	"ms-transaccional/src/controllers"
	"ms-transaccional/src/repositories"
	"ms-transaccional/src/routes"
	"ms-transaccional/src/services"

	_ "github.com/lib/pq"
)

func main() {
	dbConn := os.Getenv("DATABASE_URL")
	if dbConn == "" {
		dbConn = "postgres://pujaz_user:pujaz_password@postgres-db:5432/pujaz_transaccional?sslmode=disable"
	}
	
	db, err := sql.Open("postgres", dbConn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auctions
	repo := repositories.NewAuctionRepository(db)
	svc := services.NewAuctionService(repo)
	ctrl := controllers.NewAuctionController(svc)

	// Wallets
	walletRepo := repositories.NewWalletRepository(db)
	walletSvc := services.NewWalletService(walletRepo)
	walletCtrl := controllers.NewWalletController(walletSvc)

	mux := http.NewServeMux()
	routes.SetupAuctionRoutes(mux, ctrl)
	routes.SetupWalletRoutes(mux, walletCtrl)
	routes.SetupHealthRoutes(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting MS Transaccional on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
