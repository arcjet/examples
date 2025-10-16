FROM node:24-bookworm

WORKDIR /app

EXPOSE 4321

COPY package*.json ./
RUN npm ci

COPY . .

# Note: Nuxt requires `ARCJET_KEY` to be set during build. Here we set it to a
#       dummy value if not set to allow builds to succeed.
ENV ARCJET_KEY=${ARCJET_KEY:-ajkey_dummy}

# NOTE: Have to run postinstall as it handles automatic import resolution
RUN npm run postinstall && npm run build

CMD ["npm", "run", "start"]