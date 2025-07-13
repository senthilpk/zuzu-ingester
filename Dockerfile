# Use the official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Development stage (no build needed)
FROM base AS development

# Expose port
EXPOSE 3000

# Create a startup script that runs migrations first
RUN echo '#!/bin/sh\n\
echo "Running database migrations..."\n\
bun run db:migrate\n\
echo "Starting application..."\n\
bun run dev' > /app/start.sh && chmod +x /app/start.sh

# Start the application with migrations
CMD ["/app/start.sh"] 