import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { assignPendingUid } from "@/lib/clock/pending";
import { toBindingRow, toPendingRow } from "@/lib/clock/serialize";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const body = await req.json();
    if (!body.worker_id) {
      return Response.json({ error: "worker_id is required" }, { status: 400 });
    }
    const result = await assignPendingUid(id, body.worker_id);
    return Response.json({
      binding: toBindingRow(result.binding),
      pending: toPendingRow(result.pending),
    });
  } catch (err) {
    return jsonError(err);
  }
}
