FROM node:20-alpine

# Dependências nativas para bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 3010

CMD ["node", "src/index.js"]
