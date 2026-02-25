FROM golang:1.22-alpine AS builder

WORKDIR /src

COPY backend/go.mod ./
RUN go mod download

COPY backend/. ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o /out/api ./cmd/api

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /out/api /app/api
COPY --from=builder /src/db /app/db

EXPOSE 3000

ENTRYPOINT ["/app/api"]
