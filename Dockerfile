# KG: CONTRACT_Web_Deploy, ATOM_Web_Deploy
# Multi-stage build: Node → Nginx static
FROM node:24.21.0-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/check-runtime.mjs ./scripts/check-runtime.mjs
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
