# Multi-stage Dockerfile for Rust + Burn + Phi Models Development Environment
# Optimized for VibeCode AI workbench platform

# Stage 1: Base Rust environment with system dependencies
FROM rust:1.75-slim-bookworm AS rust-base

# Install system dependencies for Burn and AI workloads
RUN apt-get update && apt-get install -y \
    # Build essentials
    build-essential \
    pkg-config \
    cmake \
    # GPU support libraries
    libnvidia-compute-520 \
    libnvidia-ml-dev \
    # Audio/Media for multimodal models
    libssl-dev \
    libsqlite3-dev \
    # Networking and protocols
    curl \
    wget \
    git \
    # Python for interop (optional)
    python3 \
    python3-pip \
    # Debugging and profiling tools
    gdb \
    valgrind \
    perf \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain components
RUN rustup component add \
    rustfmt \
    clippy \
    rust-src \
    rust-analyzer

# Install additional targets for cross-compilation
RUN rustup target add \
    x86_64-unknown-linux-gnu \
    aarch64-unknown-linux-gnu \
    wasm32-unknown-unknown

# Stage 2: Burn framework and AI development tools
FROM rust-base AS burn-dev

# Set working directory
WORKDIR /workspace

# Install global Rust tools for AI development
RUN cargo install \
    # Performance profiling
    flamegraph \
    cargo-criterion \
    # Code quality
    cargo-audit \
    cargo-deny \
    cargo-udeps \
    # Development utilities
    cargo-watch \
    cargo-expand \
    # WebAssembly tools
    wasm-pack \
    # Model format tools
    && rm -rf ~/.cargo/registry

# Install Python dependencies for model conversion (optional)
RUN pip3 install --no-cache-dir \
    torch \
    transformers \
    onnx \
    onnxruntime \
    huggingface-hub \
    tokenizers

# Create non-root user for development
RUN useradd -m -u 1000 -s /bin/bash developer && \
    usermod -aG sudo developer && \
    echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up directory structure
RUN mkdir -p /workspace/{models,cache,projects} && \
    chown -R developer:developer /workspace

# Switch to developer user
USER developer

# Install user-level Rust tools
RUN cargo install \
    # LSP and development
    rust-analyzer \
    # Burn-specific tools (when available)
    # burn-cli \
    && rm -rf ~/.cargo/registry

# Stage 3: Production runtime for Burn applications
FROM debian:bookworm-slim AS burn-runtime

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    # SSL certificates
    ca-certificates \
    # GPU runtime (if available)
    libnvidia-compute-520 \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Create runtime user
RUN useradd -m -u 1001 -s /bin/bash runtime

# Set working directory
WORKDIR /app

# Copy application from builder stage (placeholder for actual builds)
# COPY --from=builder /workspace/target/release/app /usr/local/bin/
# COPY --from=builder /workspace/models /app/models

# Set proper ownership
RUN chown -R runtime:runtime /app

# Switch to runtime user
USER runtime

# Health check for Burn applications
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command (will be overridden by specific applications)
CMD ["echo", "Burn runtime ready - specify your application command"]

# Stage 4: Development environment with VS Code integration
FROM burn-dev AS vscode-dev

# Switch back to root for VS Code setup
USER root

# Install VS Code Server dependencies
RUN apt-get update && apt-get install -y \
    # VS Code requirements
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libgtk-4-1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    # Additional development tools
    zsh \
    fish \
    tmux \
    vim \
    nano \
    htop \
    tree \
    jq \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install code-server (VS Code in browser)
ARG CODE_SERVER_VERSION=4.101.2
RUN curl -fsSL https://code-server.dev/install.sh | sh -s -- --version=${CODE_SERVER_VERSION}

# Switch back to developer user
USER developer

# Set up VS Code extensions for Rust + AI development
RUN code-server --install-extension rust-lang.rust-analyzer && \
    code-server --install-extension vadimcn.vscode-lldb && \
    code-server --install-extension tamasfe.even-better-toml && \
    code-server --install-extension serayuzgur.crates && \
    code-server --install-extension fill-labs.dependi && \
    # AI/ML extensions
    code-server --install-extension ms-python.python && \
    code-server --install-extension ms-toolsai.jupyter && \
    # General development
    code-server --install-extension eamodio.gitlens && \
    code-server --install-extension ms-vscode.hexeditor && \
    code-server --install-extension redhat.vscode-yaml

# Create VS Code settings for optimal Rust development
RUN mkdir -p ~/.local/share/code-server/User && \
    echo '{ \
        "rust-analyzer.cargo.buildScripts.enable": true, \
        "rust-analyzer.checkOnSave.command": "clippy", \
        "rust-analyzer.completion.addCallParentheses": false, \
        "rust-analyzer.completion.addCallArgumentSnippets": false, \
        "editor.formatOnSave": true, \
        "editor.rulers": [100], \
        "files.watcherExclude": { \
            "**/target/**": true \
        }, \
        "terminal.integrated.defaultProfile.linux": "bash", \
        "workbench.colorTheme": "Default Dark+" \
    }' > ~/.local/share/code-server/User/settings.json

# Set up shell configuration for development
RUN echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc && \
    echo 'export RUST_BACKTRACE=1' >> ~/.bashrc && \
    echo 'export RUST_LOG=info' >> ~/.bashrc && \
    echo 'alias ll="ls -la"' >> ~/.bashrc && \
    echo 'alias cb="cargo build"' >> ~/.bashrc && \
    echo 'alias ct="cargo test"' >> ~/.bashrc && \
    echo 'alias cr="cargo run"' >> ~/.bashrc && \
    echo 'alias cc="cargo check"' >> ~/.bashrc

# Expose VS Code server port
EXPOSE 8080

# Set default working directory
WORKDIR /workspace

# Default command for development environment
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "--disable-telemetry", "/workspace"]

# Build-time labels
LABEL maintainer="VibeCode Team <team@vibecode.dev>"
LABEL version="1.0.0"
LABEL description="Rust + Burn + Phi Models development environment for VibeCode"
LABEL org.opencontainers.image.title="VibeCode Rust-Burn Development Environment"
LABEL org.opencontainers.image.description="Complete development environment for Rust AI applications using Burn framework and Microsoft Phi models"
LABEL org.opencontainers.image.vendor="VibeCode Platform"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/vibecode/vibecode-webgui"

# Environment variables for Burn framework
ENV BURN_BACKEND=ndarray
ENV BURN_CACHE_DIR=/workspace/cache
ENV BURN_LOG_LEVEL=info
ENV RUST_BACKTRACE=1
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true