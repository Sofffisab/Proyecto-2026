import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { cacheResponse } from "../../../src/middlewares/cache.middleware.js";

describe("cacheResponse middleware", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it("calls next() and wraps res.json", () => {
    const middleware = cacheResponse(300);
    const originalJson = res.json;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toBe(originalJson);
  });

  it("sets Cache-Control with the given maxAgeSeconds and an ETag when res.json is called", () => {
    const middleware = cacheResponse(300);
    middleware(req, res, next);

    const body = { test: "data" };
    res.json(body);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, max-age=300");
    const expectedEtag = `"${crypto.createHash("md5").update(JSON.stringify(body)).digest("hex")}"`;
    expect(res.set).toHaveBeenCalledWith("ETag", expectedEtag);
  });

  it("defaults maxAgeSeconds to 60 when not provided", () => {
    const middleware = cacheResponse();
    middleware(req, res, next);

    res.json({ ok: true });

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, max-age=60");
  });

  it("returns 304 and ends the response when if-none-match matches the computed ETag", () => {
    const middleware = cacheResponse(300);
    const body = { test: "data" };
    const etag = `"${crypto.createHash("md5").update(JSON.stringify(body)).digest("hex")}"`;
    req.headers["if-none-match"] = etag;

    middleware(req, res, next);
    const result = res.json(body);

    expect(res.status).toHaveBeenCalledWith(304);
    expect(res.end).toHaveBeenCalled();
    expect(result).toBe(res);
  });

  it("calls the original res.json with the body when there is no ETag match", () => {
    const middleware = cacheResponse(300);
    req.headers["if-none-match"] = "\"some-other-etag\"";

    // Capture the original json before wrapping so we can confirm it's invoked
    const originalJsonSpy = vi.fn().mockReturnValue("original-result");
    res.json = originalJsonSpy;

    middleware(req, res, next);
    const body = { test: "data" };
    const result = res.json(body);

    expect(res.status).not.toHaveBeenCalled();
    expect(result).toBe("original-result");
  });
});
