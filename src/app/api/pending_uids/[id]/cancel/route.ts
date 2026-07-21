import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { cancelPendingUid } from "@/lib/clock/pending";
import { toPendingRow } from "@/lib/clock/serialize";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const pending = await cancelPendingUid(id);
    return Response.json(toPendingRow(pending));
  } catch (err) {
    return jsonError(err);
  }
}
