# Stage 1: Install dependencies and build the application
FROM oven/bun:latest AS builder
WORKDIR /app

# Set platform for Prisma binary download if needed (consistent with compose)
ARG TARGETPLATFORM
RUN echo "Building for platform: $TARGETPLATFORM"

# Install OS dependencies (like git, needed by some packages)
# Add others if build fails due to missing system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends git openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy root package files
COPY package.json bun.lock ./

# Copy workspace package manifests first for better layer caching
COPY packages/ packages/
COPY apps/ apps/

# Install ALL dependencies using bun install (leveraging workspace protocol)
# Use --frozen-lockfile for reproducible installs
RUN bun install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Generate Prisma client (needed for build)
RUN bun run db:generate

# --- Add ARGs and ENVs for build-time variables ---
ARG DATABASE_URL
ARG AUTH_SECRET
ARG RESEND_API_KEY
ARG REVALIDATION_SECRET
ARG NEXT_PUBLIC_PORTAL_URL
# Add other required build-time ARGs here if needed

ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV REVALIDATION_SECRET=$REVALIDATION_SECRET
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
# --- End build-time variables ---

# Build the specific app (@comp/app) directly
# Change working directory and run its build script
WORKDIR /app/apps/app
RUN bun run build
WORKDIR /app # Change back to root for subsequent COPY commands

# --- Stage 2: Create the final production image ---
FROM oven/bun:latest AS runner
WORKDIR /app

# Set platform again for consistency
ARG TARGETPLATFORM
RUN echo "Running on platform: $TARGETPLATFORM"

# Install necessary OS packages for runtime (e.g., openssl)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy necessary files from the builder stage
# Copy standalone output, public folder, and static files
COPY --from=builder /app/apps/app/.next/standalone ./
COPY --from=builder /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder /app/apps/app/public ./apps/app/public

# Copy Prisma schema and migration files needed at runtime
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Set environment variables (DATABASE_URL will be overridden by compose)
# Copy the .env file from the context (assuming it exists at build time)
# Or rely on docker-compose to provide env vars
# COPY apps/app/.env ./apps/app/.env

EXPOSE 3000

# Define the command to run the standalone Next.js server
# Note: The standalone server runs from the root of the copied output
CMD ["node", "apps/app/server.js"]