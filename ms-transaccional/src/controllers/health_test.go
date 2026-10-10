package controllers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ms-transaccional/src/routes"
)

func TestHealthCheck(t *testing.T) {
	mux := http.NewServeMux()
	routes.SetupHealthRoutes(mux)

	server := httptest.NewServer(mux)
	defer server.Close()

	res, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Errorf("Expected 200, got %d", res.StatusCode)
	}
	
	var body map[string]string
	json.NewDecoder(res.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("Expected status: ok, got %v", body["status"])
	}
}
