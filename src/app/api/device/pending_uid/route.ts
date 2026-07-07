import { NextRequest } from "next/server";
import { assertDeviceAuth, jsonError } from "@/lib/device-auth";
import { upsertPendingUid } from "@/lib/clock/pending";
import { toPendingRow } from "@/lib/clock/serialize";

export async function POST(req: NextRequest) {
  try {
    assertDeviceAuth(req);
    const body = await req.json();
    const { uid, station_id, tapped_at } = body;
    if (!uid || !station_id || !tapped_at) {
      return Response.json(
        { error: "uid, station_id, and tapped_at are required" },
        { status: 400 },
      );
    }
    const pending = await upsertPendingUid({
      uid,
      stationId: station_id,
      tappedAt: tapped_at,
    });
    return Response.json(toPendingRow(pending), { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
