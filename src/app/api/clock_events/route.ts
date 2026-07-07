import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { listClockEvents } from "@/lib/clock/events";
import { toEventRow } from "@/lib/clock/serialize";

export async function GET(req: NextRequest) {
  try {
    await requireAdminApi();
    const { searchParams } = req.nextUrl;
    const parsedLimit = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 1000)
        : 200;
    const rows = await listClockEvents({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      workerId: searchParams.get("worker_id") || undefined,
      limit,
    });
    return Response.json(rows.map(toEventRow));
  } catch (err) {
    return jsonError(err);
  }
}
