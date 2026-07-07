import { NextRequest } from "next/server";
import { assertDeviceAuth, jsonError } from "@/lib/device-auth";
import { recordClockEvent } from "@/lib/clock/events";
import { toEventRow } from "@/lib/clock/serialize";

export async function POST(req: NextRequest) {
  try {
    assertDeviceAuth(req);
    const body = await req.json();
    const { uid, station_id, tapped_at, idempotency_key } = body;
    if (!uid || !station_id || !tapped_at || !idempotency_key) {
      return Response.json(
        {
          error:
            "uid, station_id, tapped_at, and idempotency_key are required",
        },
        { status: 400 },
      );
    }
    const { event, duplicate } = await recordClockEvent({
      uid,
      stationId: station_id,
      tappedAt: tapped_at,
      idempotencyKey: idempotency_key,
    });
    return Response.json(toEventRow(event), {
      status: duplicate ? 200 : 201,
    });
  } catch (err) {
    return jsonError(err);
  }
}
