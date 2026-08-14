FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port and start
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
