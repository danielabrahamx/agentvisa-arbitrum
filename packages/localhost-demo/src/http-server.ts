import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Hex } from "viem";

import { DEMO_CREDENTIAL_GROUP_ID, ROBOT_RALLY_APPLICATION_ID } from "./constants.js";
import { DemoApplication } from "./demo-application.js";
import { DEMO_STYLES, renderDemoPage, type DemoPagePath } from "./pages.js";

const PAGE_PATHS = new Set<DemoPagePath>([
  "/enroll",
  "/games/robot-rally",
  "/operator/robot-rally",
  "/audit",
]);
const MAXIMUM_BODY_BYTES = 1_000_000;

export function createDemoHttpServer(application: DemoApplication) {
  return createServer((request, response) => {
    void routeRequest(application, request, response).catch(() => {
      sendJson(response, 500, { error: "request_failed" });
    });
  });
}

async function routeRequest(
  application: DemoApplication,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setSecurityHeaders(response);
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET" && PAGE_PATHS.has(url.pathname as DemoPagePath)) {
    sendText(
      response,
      200,
      "text/html; charset=utf-8",
      renderDemoPage(url.pathname as DemoPagePath),
    );
    return;
  }
  if (request.method === "GET" && url.pathname === "/assets/styles.css") {
    sendText(response, 200, "text/css; charset=utf-8", DEMO_STYLES);
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    await sendPublicAsset(response, url.pathname.slice("/assets/".length));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, {
      stableApplicationId: ROBOT_RALLY_APPLICATION_ID,
      credentialGroupId: DEMO_CREDENTIAL_GROUP_ID,
      snarkArtifacts: {
        wasm: "/assets/semaphore-1.wasm",
        zkey: "/assets/semaphore-1.zkey",
      },
      rewardClaim: application.rewardClaimConfig,
      trustLabels: {
        identity: "off-chain synthetic",
        reward: "Arbitrum Sepolia GameRewardClaim",
      },
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/operator/accounts") {
    sendJson(response, 200, { accounts: application.listOperatorAccounts() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/audit") {
    sendJson(response, 200, {
      classification: "application-scoped redacted events",
      events: application.listAuditEvents(),
    });
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  const body = await readJson(request);
  if (body === undefined) {
    sendJson(response, 400, { error: "malformed_request" });
    return;
  }
  if (url.pathname === "/api/enroll") {
    const result = await application.enroll(body);
    sendJson(
      response,
      result.status === "conflict" ? 409 : result.status === "rejected" ? 400 : 200,
      result,
    );
    return;
  }
  if (url.pathname === "/api/register") {
    const result = await application.register(body);
    sendJson(
      response,
      result.status === "conflict" ? 409 : result.status === "rejected" ? 400 : 200,
      result,
    );
    return;
  }
  if (url.pathname === "/api/game/login-challenge") {
    const accountId = getAccountId(body);
    if (accountId === undefined) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result = application.createLoginChallenge(accountId);
    sendJson(response, result.status === "created" ? 200 : 403, result);
    return;
  }
  if (url.pathname === "/api/game/session") {
    const session = parseSessionRequest(body);
    if (session === undefined) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result = await application.createSession(session.accountId, session.authentication);
    sendJson(response, result.status === "created" ? 200 : 403, result);
    return;
  }
  if (url.pathname === "/api/game/play") {
    const metadata = parsePlayerMetadata(body);
    const token = getBearerToken(request);
    if (metadata === undefined || token === undefined) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result = application.play(token, metadata);
    sendJson(response, result.status === "played" ? 200 : 403, result);
    return;
  }
  if (url.pathname === "/api/game/win") {
    const token = getBearerToken(request);
    if (token === undefined || !isEmptyRecord(body)) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result = application.win(token);
    sendJson(response, result.status === "won" ? 200 : 403, result);
    return;
  }
  if (url.pathname === "/api/game/claim-authorization") {
    const token = getBearerToken(request);
    const recipient = parseClaimRecipient(body);
    if (token === undefined || recipient === undefined) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result = await application.issueClaimAuthorization(token, recipient);
    const status =
      result.status === "issued"
        ? 200
        : result.reason === "malformed_request" || result.reason === "claim_disabled"
          ? 400
          : 403;
    sendJson(response, status, result);
    return;
  }
  if (url.pathname === "/api/operator/flag" || url.pathname === "/api/operator/ban") {
    const accountId = getAccountId(body);
    if (accountId === undefined) {
      sendJson(response, 400, { error: "malformed_request" });
      return;
    }
    const result =
      url.pathname === "/api/operator/flag"
        ? application.flagBot(accountId)
        : application.ban(accountId);
    sendJson(response, result === undefined || result === false ? 404 : 200, { result });
    return;
  }
  sendJson(response, 404, { error: "not_found" });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"];
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return undefined;
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as string);
    length += bytes.length;
    if (length > MAXIMUM_BODY_BYTES) return undefined;
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function parseSessionRequest(
  input: unknown,
): { readonly accountId: Hex; readonly authentication: unknown } | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ["accountId", "authentication"])) return undefined;
  const accountId = parseAccountId(input.accountId);
  return accountId === undefined ? undefined : { accountId, authentication: input.authentication };
}

function parsePlayerMetadata(
  input: unknown,
): { readonly username?: string; readonly wallet?: string } | undefined {
  if (
    !isRecord(input) ||
    !Object.keys(input).every((key) => key === "username" || key === "wallet")
  ) {
    return undefined;
  }
  if (
    input.username !== undefined &&
    (typeof input.username !== "string" ||
      input.username.length < 1 ||
      input.username.length > 32 ||
      input.username.trim() !== input.username)
  ) {
    return undefined;
  }
  if (
    input.wallet !== undefined &&
    (typeof input.wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(input.wallet))
  ) {
    return undefined;
  }
  return {
    ...(input.username === undefined ? {} : { username: input.username }),
    ...(input.wallet === undefined ? {} : { wallet: input.wallet }),
  };
}

function getAccountId(input: unknown): Hex | undefined {
  return isRecord(input) && hasExactKeys(input, ["accountId"])
    ? parseAccountId(input.accountId)
    : undefined;
}

function parseClaimRecipient(input: unknown): string | undefined {
  if (!isRecord(input) || !hasExactKeys(input, ["recipient"])) return undefined;
  return typeof input.recipient === "string" && /^0x[0-9a-fA-F]{40}$/.test(input.recipient)
    ? input.recipient
    : undefined;
}

function parseAccountId(value: unknown): Hex | undefined {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value as Hex)
    : undefined;
}

function getBearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (
    authorization === undefined ||
    !authorization.startsWith("Bearer ") ||
    authorization.length > 512
  ) {
    return undefined;
  }
  const token = authorization.slice("Bearer ".length);
  return token.length === 0 ? undefined : token;
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

async function sendPublicAsset(response: ServerResponse, name: string): Promise<void> {
  if (!/^(client\.js|semaphore-1\.(wasm|zkey))$/.test(name)) {
    sendJson(response, 404, { error: "not_found" });
    return;
  }
  try {
    const value = await readFile(join(import.meta.dirname, "public", name));
    const contentType = name.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : name.endsWith(".wasm")
        ? "application/wasm"
        : "application/octet-stream";
    response.writeHead(200, { "content-type": contentType, "content-length": value.length });
    response.end(value);
  } catch {
    sendJson(response, 404, { error: "not_found" });
  }
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self'",
      "worker-src 'self' blob:",
      "connect-src 'self' https://sepolia-rollup.arbitrum.io https://*.arbitrum.io",
      "img-src 'self' data:",
    ].join("; "),
  );
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.headersSent) return;
  sendText(
    response,
    status,
    "application/json; charset=utf-8",
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

function sendText(
  response: ServerResponse,
  status: number,
  contentType: string,
  value: string,
): void {
  response.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(value),
  });
  response.end(value);
}
