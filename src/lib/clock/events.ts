import { ClockEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUidAssigned } from "@/lib/clock/pending";
import { normalizeUid } from "@/lib/clock/serialize";

export async function recordClockEvent({
  uid,
  stationId,
  tappedAt,
  idempotencyKey,
}: {
  uid: string;
  stationId: string;
  tappedAt: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.clockEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return { event: existing, duplicate: true };

  const binding = await isUidAssigned(uid);
  if (!binding) {
    throw Object.assign(new Error("UID not assigned to any worker"), {
      status: 404,
    });
  }

  const lastEvent = await prisma.clockEvent.findFirst({
    where: { workerId: binding.workerId },
    orderBy: { tappedAt: "desc" },
  });

  const eventType =
    !lastEvent || lastEvent.eventType === ClockEventType.OUT
      ? ClockEventType.IN
      : ClockEventType.OUT;

  const event = await prisma.clockEvent.create({
    data: {
      uid: normalizeUid(uid),
      workerId: binding.workerId,
      stationId,
      eventType,
      tappedAt,
      idempotencyKey,
    },
  });

  return { event, duplicate: false };
}

export async function listClockEvents({
  from,
  to,
  workerId,
  limit = 200,
}: {
  from?: string;
  to?: string;
  workerId?: string;
  limit?: number;
} = {}) {
  const capped = Math.min(Math.max(limit, 1), 1000);
  const tappedAt: { gte?: string; lte?: string } = {};
  if (from) tappedAt.gte = from;
  if (to) tappedAt.lte = to;

  return prisma.clockEvent.findMany({
    where: {
      ...(Object.keys(tappedAt).length ? { tappedAt } : {}),
      ...(workerId ? { workerId } : {}),
    },
    include: { worker: true },
    orderBy: { tappedAt: "desc" },
    take: capped,
  });
}
