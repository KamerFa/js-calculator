FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Remix app
RUN npm run build

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
