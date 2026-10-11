FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /ms-transaccional main.go

FROM alpine:latest
WORKDIR /app
COPY --from=builder /ms-transaccional .
COPY migrations/ ./migrations/

CMD ["./ms-transaccional"]
