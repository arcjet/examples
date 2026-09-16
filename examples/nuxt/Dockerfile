FROM node:24-bookworm

WORKDIR /app

EXPOSE 4321

COPY package*.json ./
RUN npm ci

COPY . .

# Nuxt requires `ARCJET_KEY` at build time. Keep the placeholder on this RUN
# only — do not persist it as a runtime ENV or the image ships a dummy key.
ARG ARCJET_KEY=ajkey_yourkey
RUN ARCJET_KEY=$ARCJET_KEY npm run postinstall && npm run build

CMD ["npm", "run", "start"]