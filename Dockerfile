## build runner
FROM node:latest AS build-runner

# Set temp directory
WORKDIR /tmp/app

# Move package.json
COPY package.json .

# Install dependencies
RUN npm install

# Move source files
COPY src ./src
COPY tsconfig.json   .

# Build project
RUN npm run build

## production runner
FROM node:latest AS prod-runner

# Set work directory
WORKDIR /app

# Copy .env file
COPY .env /app/.env

# Copy package.json from build-runner
COPY --from=build-runner /tmp/app/package.json /app/package.json

# Install dependencies
RUN npm install --omit=dev

# Move build files
COPY --from=build-runner /tmp/app/dist /app/dist

# Start bot
CMD [ "npm", "run", "start" ]
