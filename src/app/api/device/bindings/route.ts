import { NextRequest } from "next/server";
import { assertDeviceAuth, jsonError } from "@/lib/device-auth";
import { getActiveBindings } from "@/lib/clock/pending";

export async function GET(req: NextRequest) {
  try {
    assertDeviceAuth(req);
    const rows = await getActiveBindings();
    return Response.json(
      rows.map((r) => ({
        uid: r.uid,
        worker_id: r.workerId,
        worker_name: r.worker.name,
      })),
    );
  } catch (err) {
    return jsonError(err);
  }
}
