FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app
COPY package.json server.js ./
RUN npm install --omit=dev

EXPOSE 3001
HEALTHCHECK CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
