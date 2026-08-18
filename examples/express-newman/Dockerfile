FROM node:24-bookworm

WORKDIR /app

EXPOSE 8080

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]
