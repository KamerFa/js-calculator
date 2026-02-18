FROM node:18-alpine

# Required for Prisma with PostgreSQL
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
