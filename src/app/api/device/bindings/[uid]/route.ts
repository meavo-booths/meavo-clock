import { NextRequest } from "next/server";
import { assertDeviceAuth, jsonError } from "@/lib/device-auth";
import { isUidAssigned } from "@/lib/clock/pending";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    assertDeviceAuth(req);
    const { uid } = await params;
    const binding = await isUidAssigned(uid);
    if (!binding) {
      return Response.json({ error: "Not assigned" }, { status: 404 });
    }
    return Response.json({
      uid: binding.uid,
      worker_id: binding.workerId,
      worker_name: binding.worker.name,
    });
  } catch (err) {
    return jsonError(err);
  }
}
