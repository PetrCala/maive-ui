import type { NextApiResponse } from "next";

// Structured error envelope for the public `/v1` API (design §6.1). The
// legacy `/api/runs*` routes intentionally keep their plain `{ error: string }`
// shape and do not use this helper.

export type ApiErrorCode =
  | "validation_error"
  | "not_found"
  | "method_not_allowed"
  | "payload_too_large"
  | "rate_limited"
  | "internal_error"
  | "not_configured";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  validation_error: 400,
  not_found: 404,
  method_not_allowed: 405,
  payload_too_large: 413,
  rate_limited: 429,
  internal_error: 500,
  not_configured: 503,
};

export const sendApiError = (
  res: NextApiResponse<ApiErrorBody>,
  code: ApiErrorCode,
  message: string,
) => res.status(STATUS_BY_CODE[code]).json({ error: { code, message } });
