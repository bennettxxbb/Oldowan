# OCI labels — GitHub uses source to link the package to the repo
LABEL org.opencontainers.image.source="https://github.com/bennettxxbb/Oldowan"
LABEL org.opencontainers.image.description="Oldowan web frontend"
LABEL org.opencontainers.image.licenses="MIT"

# Stage 1: Build the Angular application
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies (ci for reproducible builds)
RUN npm ci

# Copy application source
COPY . .

# Build the application in production mode
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-bookworm

# Replace default nginx config with our custom one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from the build stage
COPY --from=build /app/dist/Oldowan/browser /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
