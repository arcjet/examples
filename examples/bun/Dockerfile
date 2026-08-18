FROM oven/bun:1

WORKDIR /app

EXPOSE 3000

COPY package.json ./
RUN bun install

COPY . .

CMD ["bun", "run", "start"]
