# Stage 1: Install deps + build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY server/ server/
COPY client/ client/
RUN cd server && npx prisma generate && npx tsc
RUN cd client && npx tsc

# Stage 2: Production (slim)
FROM node:20-alpine
WORKDIR /app
# Copy root workspace structure
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/prisma ./server/prisma
# Copy client (built HTML/CSS/JS served as static files)
COPY --from=build /app/client/index.html ./client/
COPY --from=build /app/client/styles.css ./client/
COPY --from=build /app/client/dist ./client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
