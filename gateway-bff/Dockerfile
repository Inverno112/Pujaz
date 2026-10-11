FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/ dist/
# El schema se lee en tiempo de ejecución desde ../../docs/contrato relativo a dist/ (/docs/contrato).
# Viene del contexto adicional "contrato", que apunta a docs/contrato/ de la raíz del repositorio.
COPY --from=contrato schema.graphql /docs/contrato/schema.graphql
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
