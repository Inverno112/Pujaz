package routes

import (
	"net/http"
	"ms-transaccional/src/controllers"
)

func SetupWalletRoutes(mux *http.ServeMux, controller *controllers.WalletController) {
	mux.HandleFunc("/users/", controller.HandleUsers)
}
