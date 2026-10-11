package controllers

import (
	"encoding/json"
	"net/http"
	"ms-transaccional/src/models"
	"ms-transaccional/src/services"
	"strings"
)

type UserController struct {
	service *services.UserService
}

func NewUserController(service *services.UserService) *UserController {
	return &UserController{service: service}
}

func (c *UserController) handleError(w http.ResponseWriter, err error) {
	switch err {
	case services.ErrNotFound:
		writeError(w, http.StatusNotFound, "NOT_FOUND", "User not found")
	case services.ErrEmailTaken:
		writeError(w, http.StatusConflict, "EMAIL_TAKEN", "Email is already taken")
	case services.ErrInvalidCredentials:
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid credentials")
	case services.ErrBadUserInput:
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid user input")
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
	}
}

func (c *UserController) HandleUsers(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	
	// /users or /users/
	if len(parts) == 2 && parts[1] == "users" || (len(parts) == 3 && parts[1] == "users" && parts[2] == "") {
		if r.Method == http.MethodPost {
			c.Register(w, r)
			return
		}
	}

	// /users/verify-credentials
	if len(parts) == 3 && parts[1] == "users" && parts[2] == "verify-credentials" {
		if r.Method == http.MethodPost {
			c.VerifyCredentials(w, r)
			return
		}
	}

	// /users/{id}
	if len(parts) == 3 && parts[1] == "users" && parts[2] != "verify-credentials" && parts[2] != "" {
		id := parts[2]
		switch r.Method {
		case http.MethodGet:
			c.GetUser(w, r, id)
			return
		case http.MethodPatch, http.MethodPut:
			c.UpdateUser(w, r, id)
			return
		case http.MethodDelete:
			c.DeleteUser(w, r, id)
			return
		}
	}

	writeError(w, http.StatusNotFound, "NOT_FOUND", "Not found")
}

func (c *UserController) Register(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}

	user, err := c.service.Register(r.Context(), req)
	if err != nil {
		c.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func (c *UserController) VerifyCredentials(w http.ResponseWriter, r *http.Request) {
	var req models.VerifyCredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}

	user, err := c.service.VerifyCredentials(r.Context(), req.Email, req.Password)
	if err != nil {
		c.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

func (c *UserController) GetUser(w http.ResponseWriter, r *http.Request, id string) {
	user, err := c.service.GetUser(r.Context(), id)
	if err != nil {
		c.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

func (c *UserController) UpdateUser(w http.ResponseWriter, r *http.Request, id string) {
	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_USER_INPUT", "Invalid JSON")
		return
	}

	user, err := c.service.UpdateUser(r.Context(), id, req)
	if err != nil {
		c.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

func (c *UserController) DeleteUser(w http.ResponseWriter, r *http.Request, id string) {
	err := c.service.DeleteUser(r.Context(), id)
	if err != nil {
		c.handleError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
