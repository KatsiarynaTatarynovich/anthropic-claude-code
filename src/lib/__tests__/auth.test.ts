// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import { createSession, getSession, deleteSession, verifySession } from "../auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(payload: Record<string, unknown>, expiresAt?: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    .setIssuedAt()
    .sign(JWT_SECRET);
}

function makeRequest(token?: string): NextRequest {
  return {
    cookies: {
      get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession

test("createSession sets auth-token cookie with correct options", async () => {
  await createSession("user-1", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe(COOKIE_NAME);
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.secure).toBe(false);
});

test("createSession stores a signed JWT containing userId and email", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("test@example.com");
});

test("createSession sets secure:true in production", async () => {
  const original = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";
  try {
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(true);
  } finally {
    (process.env as any).NODE_ENV = original;
  }
});

test("createSession sets cookie expiry to approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession sets JWT exp to approximately 7 days from now", async () => {
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-1", "test@example.com");
  const after = Math.floor(Date.now() / 1000);

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const sevenDaysSec = 7 * 24 * 60 * 60;
  expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysSec - 5);
  expect(payload.exp).toBeLessThanOrEqual(after + sevenDaysSec + 5);
});

// getSession

test("getSession returns null when no cookie exists", async () => {
  mockCookieStore.get.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("getSession returns session payload for valid token", async () => {
  const token = await makeToken({ userId: "user-1", email: "test@example.com" });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null for malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not-a-jwt" });
  expect(await getSession()).toBeNull();
});

test("getSession returns null for expired token", async () => {
  const token = await makeToken(
    { userId: "user-1", email: "test@example.com" },
    new Date(Date.now() - 60_000)
  );
  mockCookieStore.get.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});

// deleteSession

test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();
  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
});

// verifySession

test("verifySession returns null when no token in request", async () => {
  expect(await verifySession(makeRequest())).toBeNull();
});

test("verifySession returns session payload for valid token", async () => {
  const token = await makeToken({ userId: "user-2", email: "other@example.com" });
  const session = await verifySession(makeRequest(token));
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("other@example.com");
});

test("verifySession returns null for malformed token", async () => {
  expect(await verifySession(makeRequest("garbage"))).toBeNull();
});

test("verifySession returns null for expired token", async () => {
  const token = await makeToken(
    { userId: "user-2", email: "other@example.com" },
    new Date(Date.now() - 60_000)
  );
  expect(await verifySession(makeRequest(token))).toBeNull();
});
