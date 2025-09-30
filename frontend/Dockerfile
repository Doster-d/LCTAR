FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack to ensure yarn is available and reproducible
RUN corepack enable

COPY package.json yarn.lock webpack.config.js config-overrides.js .babelrc ./

# Install dependencies using yarn with the project's lockfile
RUN yarn install --frozen-lockfile

COPY . .

# Allow build-time configuration of API_URL and NODE_ENV for webpack
ARG API_URL
ARG NODE_ENV=production
ENV API_URL=${API_URL}
ENV NODE_ENV=${NODE_ENV}

# Build static assets into the dist directory
RUN yarn build

FROM nginx:1.27-alpine AS runtime

# Clean default config and copy custom nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Placeholder directory for TLS assets to be provided at runtime
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
