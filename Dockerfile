FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build && npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/main.js"]
