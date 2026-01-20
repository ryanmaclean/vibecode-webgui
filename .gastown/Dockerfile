# Gas Town Portable Runtime Container
# Toyota Production System Edition
#
# Build: docker build -t gastown-runtime .gastown/
# Run: docker run -it --rm -v $(pwd):/genba gastown-runtime

FROM golang:1.22-alpine AS builder

# Install Gas Town and Beads
RUN go install github.com/steveyegge/gastown/cmd/gt@latest
RUN go install github.com/steveyegge/beads/cmd/bd@latest

FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    tmux \
    nodejs \
    npm \
    curl \
    jq \
    bash

# Copy binaries from builder
COPY --from=builder /go/bin/gt /usr/local/bin/
COPY --from=builder /go/bin/bd /usr/local/bin/

# Set up Gas Town environment
ENV GASTOWN_RUNTIME=docker
ENV GASTOWN_NAMING=toyota-way
ENV GENBA=/genba

# Create directories
RUN mkdir -p /genba /kanban /andon

# Working directory is the Genba (real place/codebase)
WORKDIR /genba

# Volume mounts
VOLUME ["/genba", "/kanban", "/andon"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
    CMD gt status || exit 1

# Entry point
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]

# Default command: start Sensei (Mayor)
CMD ["sensei"]
