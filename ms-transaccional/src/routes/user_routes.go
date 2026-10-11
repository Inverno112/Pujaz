package routes

import (
	"net/http"
	"strings"
	"ms-transaccional/src/controllers"
)

func SetupUserRoutes(mux *http.ServeMux, userCtrl *controllers.UserController, walletCtrl *controllers.WalletController) {
	mux.HandleFunc("/users", userCtrl.HandleUsers)
	mux.HandleFunc("/users/verify-credentials", userCtrl.HandleUsers)
	
	mux.HandleFunc("/users/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.Contains(path, "/wallet") || strings.Contains(path, "/deposits") {
			walletCtrl.HandleUsers(w, r)
		} else {
			userCtrl.HandleUsers(w, r)
		}
	})
}
