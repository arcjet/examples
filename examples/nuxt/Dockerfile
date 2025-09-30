FROM node:24-bookworm

WORKDIR /app

EXPOSE 4321

COPY package*.json ./
RUN npm ci

COPY . .

# NOTE: Have to run postinstall as it handles automatic import resolution
RUN npm run postinstall && npm run build

CMD ["npm", "run", "start"]