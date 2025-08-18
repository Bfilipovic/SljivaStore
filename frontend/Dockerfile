FROM node:18-alpine

WORKDIR /app

# install deps
COPY package*.json ./
RUN npm install

# copy source
COPY . .

# build app with adapter-node
RUN npm run build

# expose configured port
EXPOSE 3000

# start production server
CMD ["node", "build/index.js"]
