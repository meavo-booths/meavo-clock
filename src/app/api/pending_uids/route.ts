import { ClockPendingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { expirePendingUids } from "@/lib/clock/pending";
import { toPendingRow } from "@/lib/clock/serialize";

export async function GET() {
  try {
    await requireAdminApi();
    await expirePendingUids();
    const rows = await prisma.clockPendingUid.findMany({
      where: {
        status: ClockPendingStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      orderBy: { tappedAt: "desc" },
    });
    return Response.json(rows.map(toPendingRow));
  } catch (err) {
    return jsonError(err);
  }
}
