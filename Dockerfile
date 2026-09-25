FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
USER node

EXPOSE 10000
CMD ["sh", "-c", "npm run migrate && npm start"]
