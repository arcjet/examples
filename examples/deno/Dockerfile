FROM denoland/deno:debian-2.4.5

WORKDIR /app

EXPOSE 3000

COPY deno.json deno.lock ./
RUN deno install

COPY . .

CMD ["deno", "run", "start"]