import { NextRequest } from "next/server";

export function assertDeviceAuth(req: NextRequest) {
  const key = req.headers.get("x-device-key");
  const expected = process.env.DEVICE_API_KEY;
  if (!expected || key !== expected) {
    throw Object.assign(new Error("Invalid device API key"), { status: 401 });
  }
}

export function jsonError(err: unknown, fallback = 500) {
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: number }).status)
      : fallback;
  const message = err instanceof Error ? err.message : "Internal error";
  return Response.json({ error: message }, { status });
}
