# Base stage for dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# BUILD stage
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# PRODUCTION stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
RUN mkdir -p uploads/gcode logs

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
