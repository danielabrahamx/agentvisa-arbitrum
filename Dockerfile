FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY deployments ./deployments

RUN pnpm install --frozen-lockfile

ARG ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY
ENV ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY=$ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY
RUN pnpm --filter @agentvisa/localhost-demo... build

ENV PORT=8080
EXPOSE 8080

CMD ["node", "packages/localhost-demo/scripts/serve-static.mjs"]
