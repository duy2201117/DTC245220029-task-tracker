FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /srv/app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=10001:10001 server.js validation.js ./
COPY --chown=10001:10001 public ./public
USER 10001:10001
EXPOSE 3000
CMD ["node", "server.js"]
