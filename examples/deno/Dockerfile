FROM denoland/deno:debian-2.9.6

WORKDIR /app

EXPOSE 3000

COPY deno.json ./
RUN deno install

COPY . .

CMD ["deno", "run", "start"]