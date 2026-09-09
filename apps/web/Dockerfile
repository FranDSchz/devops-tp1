FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace=apps/web

COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["sh", "-c", "printf '{\"instance\":\"%s\"}' \"$INSTANCE_ID\" > /usr/share/nginx/html/instance.json && nginx -g \"daemon off;\""]
