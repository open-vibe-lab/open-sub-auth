import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mock node:undici so tests don't touch real dispatcher state.
// EnvHttpProxyAgent must use a regular function (not arrow) to be newable.
vi.mock("node:undici", () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: must be newable as a constructor
    EnvHttpProxyAgent: vi.fn(function MockEnvHttpProxyAgent() {}),
    setGlobalDispatcher: vi.fn(),
  };
});

import { EnvHttpProxyAgent, setGlobalDispatcher } from "node:undici";
import { initProxy } from "@/core/proxy.ts";

describe("initProxy", () => {
  const originalHttpsProxy = process.env.HTTPS_PROXY;
  const originalHttpProxy = process.env.HTTP_PROXY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalHttpsProxy !== undefined) {
      process.env.HTTPS_PROXY = originalHttpsProxy;
    } else {
      delete process.env.HTTPS_PROXY;
    }
    if (originalHttpProxy !== undefined) {
      process.env.HTTP_PROXY = originalHttpProxy;
    } else {
      delete process.env.HTTP_PROXY;
    }
  });

  it("installs the global dispatcher", () => {
    initProxy();
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
    expect(setGlobalDispatcher).toHaveBeenCalledWith(expect.any(Object));
  });

  it("creates an EnvHttpProxyAgent", () => {
    initProxy();
    expect(EnvHttpProxyAgent).toHaveBeenCalledTimes(1);
  });

  it("sets HTTPS_PROXY and HTTP_PROXY env vars when proxyUrl is provided", () => {
    initProxy("http://proxy.corp:8080");
    expect(process.env.HTTPS_PROXY).toBe("http://proxy.corp:8080");
    expect(process.env.HTTP_PROXY).toBe("http://proxy.corp:8080");
  });

  it("does not set env vars when no proxyUrl is provided", () => {
    initProxy();
    expect(process.env.HTTPS_PROXY).toBeUndefined();
    expect(process.env.HTTP_PROXY).toBeUndefined();
  });

  it("still installs dispatcher even when no proxyUrl is provided (reads existing env vars)", () => {
    process.env.HTTPS_PROXY = "http://existing-proxy:3128";
    initProxy();
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
    expect(EnvHttpProxyAgent).toHaveBeenCalledTimes(1);
  });

  it("can be called multiple times (each call re-installs dispatcher)", () => {
    initProxy("http://proxy1:8080");
    initProxy("http://proxy2:9090");
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(2);
    expect(process.env.HTTPS_PROXY).toBe("http://proxy2:9090");
  });
});
