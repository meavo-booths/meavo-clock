import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { listAssignableUsers, listWorkers } from "@/lib/clock/workers";
import { toWorkerRow } from "@/lib/clock/serialize";

export async function GET(req: Request) {
  try {
    await requireAdminApi();
    const all = new URL(req.url).searchParams.get("all") === "1";
    const workers = all ? await listAssignableUsers() : await listWorkers();
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
