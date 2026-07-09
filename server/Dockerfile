# Use Node.js 20 Slim as the base image
FROM node:20-slim

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install all dependencies (Prisma CLI is needed for generation)
RUN npm ci

# Copy Prisma schema and generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy all other server files to the working directory
COPY . .

# Expose port 4000 (the port Express is listening on)
EXPOSE 4000

# Start the Express server
CMD ["npm", "start"]
