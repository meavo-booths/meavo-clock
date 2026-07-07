import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { deactivateWorker } from "@/lib/clock/workers";
import { toWorkerRow } from "@/lib/clock/serialize";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const worker = await deactivateWorker(id);
    return Response.json(toWorkerRow(worker));
  } catch (err) {
    return jsonError(err);
  }
}
