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
RUN mkdir -p uploads/gcode logs

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
