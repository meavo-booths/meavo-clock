import { ClockPendingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeUid } from "@/lib/clock/serialize";
import { ensureWorkerForUser } from "@/lib/clock/workers";

const PENDING_TTL_MS = 15 * 60 * 1000;

export async function expirePendingUids() {
  const now = new Date();
  const expired = await prisma.clockPendingUid.findMany({
    where: { status: ClockPendingStatus.PENDING, expiresAt: { lte: now } },
  });

  for (const row of expired) {
    await prisma.$transaction([
      prisma.clockPendingUid.update({
        where: { id: row.id },
        data: { status: ClockPendingStatus.EXPIRED },
      }),
      prisma.clockUnassignedTap.create({
        data: {
          uid: row.uid,
          stationId: row.stationId,
          tappedAt: row.tappedAt,
          pendingUidId: row.id,
        },
      }),
    ]);
  }
  return expired.length;
}

export async function upsertPendingUid({
  uid,
  stationId,
  tappedAt,
}: {
  uid: string;
  stationId: string;
  tappedAt: string;
}) {
  await expirePendingUids();

  const normalizedUid = normalizeUid(uid);
  const now = new Date();
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  const existing = await prisma.clockPendingUid.findFirst({
    where: {
      uid: normalizedUid,
      status: ClockPendingStatus.PENDING,
      expiresAt: { gt: now },
    },
  });

  if (existing) {
    return prisma.clockPendingUid.update({
      where: { id: existing.id },
      data: { tappedAt, expiresAt, stationId },
    });
  }

  return prisma.clockPendingUid.create({
    data: {
      uid: normalizedUid,
      stationId,
      tappedAt,
      expiresAt,
      status: ClockPendingStatus.PENDING,
    },
  });
}

export async function assignPendingUid(pendingId: string, userId: string) {
  await expirePendingUids();

  const pending = await prisma.clockPendingUid.findUnique({
    where: { id: pendingId },
  });
  if (!pending) {
    throw Object.assign(new Error("Pending UID not found"), { status: 404 });
  }
  if (pending.status !== ClockPendingStatus.PENDING) {
    throw Object.assign(new Error(`Pending UID is already ${pending.status}`), {
      status: 400,
    });
  }
  if (pending.expiresAt <= new Date()) {
    await prisma.clockPendingUid.update({
      where: { id: pendingId },
      data: { status: ClockPendingStatus.EXPIRED },
    });
    throw Object.assign(new Error("Pending UID has expired"), { status: 410 });
  }

  const worker = await ensureWorkerForUser(userId);

  return prisma.$transaction(async (tx) => {
    await tx.clockCardBinding.updateMany({
      where: { uid: pending.uid, active: true },
      data: { active: false, deactivatedAt: new Date() },
    });
    const binding = await tx.clockCardBinding.create({
      data: { uid: pending.uid, workerId: worker.id, active: true },
      include: { worker: true },
    });
    const updatedPending = await tx.clockPendingUid.update({
      where: { id: pendingId },
      data: { status: ClockPendingStatus.ASSIGNED },
    });
    return { binding, pending: updatedPending };
  });
}

export async function cancelPendingUid(pendingId: string) {
  await expirePendingUids();

  const pending = await prisma.clockPendingUid.findUnique({
    where: { id: pendingId },
  });
  if (!pending) {
    throw Object.assign(new Error("Pending UID not found"), { status: 404 });
  }
  if (pending.status !== ClockPendingStatus.PENDING) {
    throw Object.assign(new Error(`Pending UID is already ${pending.status}`), {
      status: 400,
    });
  }
  if (pending.expiresAt <= new Date()) {
    await prisma.clockPendingUid.update({
      where: { id: pendingId },
      data: { status: ClockPendingStatus.EXPIRED },
    });
    throw Object.assign(new Error("Pending UID has expired"), { status: 410 });
  }

  return prisma.clockPendingUid.update({
    where: { id: pendingId },
    data: { status: ClockPendingStatus.CANCELLED },
  });
}

export async function getActiveBindings() {
  await expirePendingUids();
  return prisma.clockCardBinding.findMany({
    where: { active: true },
    include: { worker: true },
    orderBy: { worker: { name: "asc" } },
  });
}

export async function isUidAssigned(uid: string) {
  await expirePendingUids();
  return prisma.clockCardBinding.findFirst({
    where: { uid: normalizeUid(uid), active: true },
    include: { worker: true },
  });
}
