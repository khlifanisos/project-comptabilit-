# Stage 1: build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# No VITE_API_URL: the app calls /api on its own origin, which Nginx forwards to Laravel
RUN npm run build

# Stage 2: Nginx serves the built app and proxies /api to the backend
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
