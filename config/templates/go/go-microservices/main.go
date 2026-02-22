package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Configuration holds application configuration
type Configuration struct {
	Port             string
	Environment      string
	LogLevel         string
	ServiceName      string
	ShutdownTimeout  time.Duration
}

// Metrics holds Prometheus metrics
var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

// getEnv gets an environment variable with a fallback default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// loadConfig loads configuration from environment variables
func loadConfig() *Configuration {
	shutdownTimeout, _ := time.ParseDuration(getEnv("SHUTDOWN_TIMEOUT", "10") + "s")

	return &Configuration{
		Port:            getEnv("PORT", "8080"),
		Environment:     getEnv("ENVIRONMENT", "development"),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		ServiceName:     getEnv("SERVICE_NAME", "go-microservice"),
		ShutdownTimeout: shutdownTimeout,
	}
}

// loggingMiddleware logs HTTP requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create a response writer wrapper to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Call the next handler
		next.ServeHTTP(rw, r)

		// Log request details
		duration := time.Since(start)
		log.Printf("[%s] %s %s - Status: %d - Duration: %v",
			r.Method, r.URL.Path, r.RemoteAddr, rw.statusCode, duration)

		// Record metrics
		httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, fmt.Sprintf("%d", rw.statusCode)).Inc()
		httpRequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(duration.Seconds())
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Response represents a JSON response
type Response struct {
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

// healthHandler handles health check requests
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{
		Message: "healthy",
		Data: map[string]interface{}{
			"status": "ok",
		},
	})
}

// readyHandler handles readiness probe requests
func readyHandler(w http.ResponseWriter, r *http.Request) {
	// Add checks for dependencies (database, cache, etc.)
	// For now, always return ready
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(Response{
		Message: "ready",
		Data: map[string]interface{}{
			"status": "ok",
		},
	})
}

// rootHandler handles root path requests
func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Message: "Welcome to Go Microservice",
		Data: map[string]interface{}{
			"version": "1.0.0",
			"service": "go-microservice",
		},
	})
}

// statusHandler returns service status
func statusHandler(config *Configuration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{
			Message: "Service Status",
			Data: map[string]interface{}{
				"service":     config.ServiceName,
				"environment": config.Environment,
				"uptime":      time.Now().Format(time.RFC3339),
				"status":      "running",
			},
		})
	}
}

// setupRoutes configures HTTP routes
func setupRoutes(mux *http.ServeMux, config *Configuration) {
	// Health and readiness probes
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/ready", readyHandler)

	// Metrics endpoint
	mux.Handle("/metrics", promhttp.Handler())

	// Application routes
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("/api/v1/status", statusHandler(config))
}

func main() {
	// Load configuration
	config := loadConfig()

	log.Printf("Starting %s in %s mode...", config.ServiceName, config.Environment)

	// Create HTTP router
	mux := http.NewServeMux()
	setupRoutes(mux, config)

	// Create HTTP server with timeouts
	srv := &http.Server{
		Addr:         ":" + config.Port,
		Handler:      loggingMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server listening on port %s", config.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), config.ShutdownTimeout)
	defer cancel()

	// Attempt graceful shutdown
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
