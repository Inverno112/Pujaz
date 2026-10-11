package main

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	pgConnStr    = "postgres://pujaz_user:pujaz_password@localhost:5432/pujaz_transaccional?sslmode=disable"
	mongoConnStr = "mongodb://localhost:27017"
)

func getPgDB(t *testing.T) *sql.DB {
	db, err := sql.Open("postgres", pgConnStr)
	if err != nil {
		t.Fatalf("Error al abrir config Postgres: %v", err)
	}
	if err = db.Ping(); err != nil {
		t.Fatalf("No se pudo conectar a Postgres: %v", err)
	}
	return db
}

func TestMigrationsUpAndDown(t *testing.T) {
	db := getPgDB(t)
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		t.Fatalf("Fallo al crear driver Postgres: %v", err)
	}

	m, err := migrate.NewWithDatabaseInstance("file://migrations", "postgres", driver)
	if err != nil {
		t.Fatalf("Fallo al instanciar golang-migrate: %v", err)
	}

	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Error al ejecutar migraciones UP: %v", err)
	}

	err = m.Down()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Error al ejecutar migraciones DOWN: %v", err)
	}

	_ = m.Up()
}

func TestConstraints(t *testing.T) {
	db := getPgDB(t)
	defer db.Close()

	_, err := db.Exec("INSERT INTO bids (auction_id, user_id, amount) VALUES (99999, 1, 100.00)")
	if err == nil {
		t.Error("Fallo de integridad: Postgres permitió crear una puja con una subasta inexistente")
	} else if !strings.Contains(err.Error(), "violates") {
		t.Errorf("Error inesperado en bids (probablemente la tabla no existe): %v", err)
	}

	_, err = db.Exec("INSERT INTO wallets (user_id, balance_available, balance_reserved) VALUES (99999, 0, 0)")
	if err == nil {
		t.Error("Fallo de integridad: Postgres permitió crear una billetera sin un usuario válido")
	} else if !strings.Contains(err.Error(), "violates") {
		t.Errorf("Error inesperado en wallets: %v", err)
	}
}

func TestSeedConsistency(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoConnStr))
	if err != nil {
		t.Fatalf("Fallo conexión a Mongo: %v", err)
	}
	defer client.Disconnect(ctx)

	col := client.Database("pujaz_db").Collection("items")
	cursor, err := col.Find(ctx, bson.M{})
	if err != nil {
		t.Log("No se encontraron items en Mongo, saltando comprobación.")
		return
	}

	var items []bson.M
	if err = cursor.All(ctx, &items); err != nil {
		t.Fatalf("Fallo lectura de Mongo: %v", err)
	}

	db := getPgDB(t)
	defer db.Close()

	for _, item := range items {
		var mongoID string
		if idObj, ok := item["_id"].(primitive.ObjectID); ok {
			mongoID = idObj.Hex()
		} else if idStr, ok := item["_id"].(string); ok {
			mongoID = idStr
		}

		if mongoID != "" {
			var auctionID int
			err := db.QueryRow("SELECT id FROM auctions WHERE item_id = $1", mongoID).Scan(&auctionID)
			if err == sql.ErrNoRows {
				t.Errorf("Inconsistencia Semilla: El item %s está en Mongo pero NO tiene subasta en Postgres", mongoID)
			} else if err != nil {
				t.Fatalf("Error inesperado consultando Postgres: %v", err)
			}
		}
	}
}