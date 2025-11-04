import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Lightweight health check - doesn't call R backend
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
}
