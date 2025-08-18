# Use Node 18 LTS
FROM node:18-slim

# Set working dir
WORKDIR /app

# Copy package files & install
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose backend port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
