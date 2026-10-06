# Stage 1: Build React + Vite app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json vite.config.ts index.html postcss.config.js tailwind.config.js ./
RUN npm ci
COPY src ./src
COPY public ./public
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/stepcharge.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
