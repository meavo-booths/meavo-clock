import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { listCardBindings } from "@/lib/clock/workers";
import { toBindingRow } from "@/lib/clock/serialize";

export async function GET() {
  try {
    await requireAdminApi();
    const rows = await listCardBindings();
    return Response.json(rows.map(toBindingRow));
  } catch (err) {
    return jsonError(err);
  }
}
