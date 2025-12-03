FROM node:24-bookworm

WORKDIR /app

EXPOSE 5000

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run check

# Firebase functions not intended to run in Docker; exit successfully.
CMD ["exit", "0"]