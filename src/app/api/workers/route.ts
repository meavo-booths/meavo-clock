import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { listWorkers } from "@/lib/clock/workers";
import { toWorkerRow } from "@/lib/clock/serialize";

export async function GET() {
  try {
    await requireAdminApi();
    const workers = await listWorkers();
    return Response.json(workers.map(toWorkerRow));
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST() {
  return Response.json(
    {
      error:
        "Workers are created in the gateway (Admin → Users), not in clock",
    },
    { status: 405 },
  );
}
