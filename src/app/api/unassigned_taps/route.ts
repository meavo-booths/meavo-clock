import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";

export async function GET() {
  try {
    await requireAdminApi();
    const rows = await prisma.clockUnassignedTap.findMany({
      orderBy: { tappedAt: "desc" },
      take: 500,
    });
    return Response.json(
      rows.map((r) => ({
        id: r.id,
        uid: r.uid,
        station_id: r.stationId,
        tapped_at: r.tappedAt,
        pending_uid_id: r.pendingUidId,
        created_at: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return jsonError(err);
  }
}
