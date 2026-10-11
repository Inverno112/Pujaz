package routes

import (
	"net/http"
	"ms-transaccional/src/controllers"
	"strings"
)

func SetupAuctionRoutes(mux *http.ServeMux, controller *controllers.AuctionController) {
	mux.HandleFunc("/auctions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			controller.ListAuctions(w, r)
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/auctions/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		parts := strings.Split(path, "/")
		// /auctions/12
		// /auctions/12/bids
		
		if len(parts) == 3 && parts[2] == "" && r.Method == http.MethodGet {
			controller.ListAuctions(w, r)
			return
		}

		if len(parts) == 3 && parts[2] != "" && r.Method == http.MethodGet {
			controller.GetAuction(w, r)
			return
		}

		if len(parts) == 4 && parts[3] == "bids" && r.Method == http.MethodPost {
			controller.PlaceBid(w, r)
			return
		}

		http.NotFound(w, r)
	})
}
