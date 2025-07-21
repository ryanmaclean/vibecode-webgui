# ---- Build Stage ----
# This stage builds the application and creates the single binary.
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev for pkg)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the single executable binary for Linux
RUN npm run build:binary

# ---- Final Stage ----
# This stage creates the final, minimal image.
FROM SCRATCH

# Copy the compiled binary from the builder stage
COPY --from=builder /app/vibecode-cli /vibecode-cli

# Set the binary as the entrypoint for the container
ENTRYPOINT ["/vibecode-cli"]
