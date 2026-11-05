package services

import (
	"context"
	"errors"
	"ms-transaccional/src/models"
	"ms-transaccional/src/repositories"
	"strconv"
	"strings"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailTaken         = errors.New("EMAIL_TAKEN")
	ErrInvalidCredentials = errors.New("INVALID_CREDENTIALS")
	ErrBadUserInput       = errors.New("BAD_USER_INPUT")
)

var nameRegex = regexp.MustCompile(`^[A-Za-záéíóúÁÉÍÓÚñÑ\s]{3,50}$`)

func isValidPassword(s string) bool {
	// bcrypt no acepta más de 72 bytes
	if len(s) < 8 || len(s) > 72 {
		return false
	}
	hasUpper := false
	hasLower := false
	hasNumber := false
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c == 'ñ' || c == 'á' || c == 'é' || c == 'í' || c == 'ó' || c == 'ú' {
			hasLower = true
		} else if c >= 'A' && c <= 'Z' || c == 'Ñ' || c == 'Á' || c == 'É' || c == 'Í' || c == 'Ó' || c == 'Ú' {
			hasUpper = true
		} else if c >= '0' && c <= '9' {
			hasNumber = true
		}
	}
	return hasUpper && hasLower && hasNumber
}

type UserService struct {
	repo *repositories.UserRepository
}

func NewUserService(repo *repositories.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Register(ctx context.Context, req models.CreateUserRequest) (*models.User, error) {
	if strings.TrimSpace(req.Email) == "" {
		return nil, ErrBadUserInput
	}
	if !nameRegex.MatchString(strings.TrimSpace(req.Name)) || !isValidPassword(req.Password) {
		return nil, ErrBadUserInput
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.CreateUserWithWallet(ctx, req.Name, req.Email, string(hash))
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "users_email_key") {
			return nil, ErrEmailTaken
		}
		return nil, err
	}

	return user, nil
}

func (s *UserService) VerifyCredentials(ctx context.Context, email, password string) (*models.User, error) {
	user, hash, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		if err == repositories.ErrNotFound {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.Status == "inactiva" || user.Status == "eliminado" {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

func (s *UserService) GetUser(ctx context.Context, idStr string) (*models.User, error) {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return nil, ErrNotFound
	}
	return s.repo.GetUserByID(ctx, id)
}

func (s *UserService) UpdateUser(ctx context.Context, idStr string, req models.UpdateUserRequest) (*models.User, error) {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return nil, ErrNotFound
	}

	if req.Name != nil && !nameRegex.MatchString(strings.TrimSpace(*req.Name)) {
		return nil, ErrBadUserInput
	}
	if req.Email != nil && strings.TrimSpace(*req.Email) == "" {
		return nil, ErrBadUserInput
	}

	var passwordHash *string
	if req.Password != nil {
		if !isValidPassword(*req.Password) {
			return nil, ErrBadUserInput
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		h := string(hash)
		passwordHash = &h
	}

	user, err := s.repo.UpdateUser(ctx, id, req.Name, req.Email, passwordHash)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "users_email_key") {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) DeleteUser(ctx context.Context, idStr string) error {
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return ErrNotFound
	}
	return s.repo.DeleteUser(ctx, id)
}
