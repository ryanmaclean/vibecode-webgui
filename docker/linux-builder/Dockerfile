# VibeCode Linux Builder
# Multi-architecture Docker build environment for creating Linux AppImage, deb, and rpm packages
#
# Build:
#   docker build -t vibecode-linux-builder:latest -f docker/linux-builder/Dockerfile .
#
# Run (x64):
#   docker run --rm -v $(pwd):/workspace vibecode-linux-builder:latest --arch x64
#
# Run (arm64):
#   docker run --rm -v $(pwd):/workspace vibecode-linux-builder:latest --arch arm64

FROM ubuntu:22.04 AS base

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install base dependencies
RUN apt-get update && apt-get install -y \
    # Build essentials
    build-essential \
    curl \
    wget \
    git \
    pkg-config \
    # Tauri dependencies
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    libdbus-1-dev \
    libxdo-dev \
    libxcb1-dev \
    libxcb-render0-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    # AppImage tools
    squashfs-tools \
    patchelf \
    # Package building
    rpm \
    dpkg-dev \
    fakeroot \
    # Additional utilities
    file \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Rust targets
RUN rustup target add x86_64-unknown-linux-gnu \
    && rustup target add aarch64-unknown-linux-gnu

# Install Tauri CLI
RUN cargo install tauri-cli --version "^2.0"

# Install appimagetool for x86_64
RUN wget -O /usr/local/bin/appimagetool https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage \
    && chmod +x /usr/local/bin/appimagetool \
    # Extract AppImage since we can't run it in Docker without FUSE
    && cd /tmp && /usr/local/bin/appimagetool --appimage-extract \
    && mv /tmp/squashfs-root /opt/appimagetool \
    && ln -sf /opt/appimagetool/AppRun /usr/local/bin/appimagetool-extracted

# Set up workspace
WORKDIR /workspace

# Copy build script
COPY scripts/build-linux.sh /usr/local/bin/build-linux.sh
RUN chmod +x /usr/local/bin/build-linux.sh

# Entry point
ENTRYPOINT ["/usr/local/bin/build-linux.sh"]
CMD ["--arch", "all"]

# ============================================================================
# Cross-compilation stage for ARM64
# ============================================================================
FROM base AS cross-arm64

# Install ARM64 cross-compilation toolchain
RUN dpkg --add-architecture arm64 \
    && echo "deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports jammy main restricted universe multiverse" > /etc/apt/sources.list.d/arm64.list \
    && echo "deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports jammy-updates main restricted universe multiverse" >> /etc/apt/sources.list.d/arm64.list \
    && echo "deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports jammy-security main restricted universe multiverse" >> /etc/apt/sources.list.d/arm64.list \
    && sed -i 's/^deb /deb [arch=amd64] /' /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y \
        gcc-aarch64-linux-gnu \
        g++-aarch64-linux-gnu \
        libc6-dev-arm64-cross \
    # Try to install ARM64 libraries (some may not be available)
    && apt-get install -y \
        libgtk-3-dev:arm64 \
        libglib2.0-dev:arm64 \
        libssl-dev:arm64 \
        libcairo2-dev:arm64 \
        libpango1.0-dev:arm64 \
        libgdk-pixbuf-2.0-dev:arm64 \
        libatk1.0-dev:arm64 \
        || true \
    && rm -rf /var/lib/apt/lists/*

# Configure Cargo for cross-compilation
RUN mkdir -p /root/.cargo \
    && echo '[target.aarch64-unknown-linux-gnu]' >> /root/.cargo/config.toml \
    && echo 'linker = "aarch64-linux-gnu-gcc"' >> /root/.cargo/config.toml

# Set cross-compilation environment variables
ENV PKG_CONFIG_PATH_aarch64_unknown_linux_gnu="/usr/lib/aarch64-linux-gnu/pkgconfig"
ENV PKG_CONFIG_ALLOW_CROSS=1

# ============================================================================
# Production builder (default)
# ============================================================================
FROM base AS builder

# Labels
LABEL org.opencontainers.image.title="VibeCode Linux Builder"
LABEL org.opencontainers.image.description="Build environment for VibeCode Linux packages"
LABEL org.opencontainers.image.vendor="VibeCode Team"
LABEL org.opencontainers.image.source="https://github.com/vibecode/vibecode"
