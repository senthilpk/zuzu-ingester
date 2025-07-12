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

# Start the application in development mode
CMD ["bun", "run", "dev"] 