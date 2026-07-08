import { vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

export const createMockReq = (
  overrides: Partial<NextApiRequest> = {},
): NextApiRequest =>
  ({
    method: "GET",
    query: {},
    body: undefined,
    headers: {},
    ...overrides,
  }) as NextApiRequest;

export type MockResponse<T = unknown> = NextApiResponse<T> & {
  statusCode: number;
  body: T | undefined;
  headers: Record<string, string>;
};

export const createMockRes = <T = unknown>(): MockResponse<T> => {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
  } as MockResponse<T>;

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as MockResponse<T>["status"];

  res.json = vi.fn((body: T) => {
    res.body = body;
    return res;
  }) as MockResponse<T>["json"];

  res.setHeader = vi.fn((name: string, value: string | string[]) => {
    res.headers[name] = Array.isArray(value) ? value.join(", ") : value;
    return res;
  }) as MockResponse<T>["setHeader"];

  return res;
};
