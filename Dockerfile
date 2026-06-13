FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
# Reprodukowalna instalacja z pliku lock (produkcyjnie, bez devDependencies).
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173

EXPOSE 5173

CMD ["npm", "start"]
