import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { deactivateCard } from "@/lib/clock/workers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await requireAdminApi();
    const { uid } = await params;
    return Response.json(await deactivateCard(uid));
  } catch (err) {
    return jsonError(err);
  }
}
