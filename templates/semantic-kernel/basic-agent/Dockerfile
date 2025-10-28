# Multi-stage Dockerfile for Semantic Kernel Basic Agent
# Optimized for VibeCode platform deployment

# Stage 1: Build environment
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build

# Install native dependencies
RUN apk add --no-cache \
    curl \
    git \
    bash

# Set working directory
WORKDIR /src

# Copy project file
COPY *.csproj .
RUN dotnet restore --runtime linux-musl-x64

# Copy source code
COPY . .

# Build the application
RUN dotnet publish -c Release -o /app/publish \
    --no-restore \
    --runtime linux-musl-x64 \
    --self-contained false

# Stage 2: Runtime environment
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    # Required for .NET applications
    icu-libs \
    # Debugging and monitoring tools
    curl \
    # Process management
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S semantic-kernel && \
    adduser -S semantic-kernel -u 1001 -G semantic-kernel

# Set working directory
WORKDIR /app

# Copy published application
COPY --from=build --chown=semantic-kernel:semantic-kernel /app/publish ./

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R semantic-kernel:semantic-kernel /app

# Switch to non-root user
USER semantic-kernel

# Environment variables
ENV DOTNET_RUNNING_IN_CONTAINER=true
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
ENV OPENAI_API_KEY=""
ENV AZURE_OPENAI_ENDPOINT=""
ENV AZURE_OPENAI_API_KEY=""

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Labels
LABEL maintainer="VibeCode Team <team@vibecode.dev>"
LABEL version="1.0.0"
LABEL description="Semantic Kernel Basic Agent for VibeCode platform"
LABEL org.opencontainers.image.title="VibeCode Semantic Kernel Agent"
LABEL org.opencontainers.image.description=".NET 8 application with Microsoft Semantic Kernel integration"
LABEL org.opencontainers.image.vendor="VibeCode Platform"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/vibecode/vibecode-webgui"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["dotnet", "VibeCode.SemanticKernel.BasicAgent.dll"]