package routes

import (
	"net/http"
	"ms-transaccional/src/controllers"
)

func SetupHealthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", controllers.HealthCheck)
}
