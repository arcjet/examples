FROM node:24-bookworm

WORKDIR /app

EXPOSE 5173

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]