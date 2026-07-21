import { prisma } from "@/lib/prisma";
import { normalizeUid } from "@/lib/clock/serialize";

export type WorkerListRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  cardUid: string | null;
  clockWorkerId: string | null;
};

function displayName(user: { name: string | null; email: string }) {
  return user.name?.trim() || user.email;
}

/** Resolve a public worker id (User id preferred, or legacy ClockWorker id). */
export async function findClockWorkerByPublicId(id: string) {
  return prisma.clockWorker.findFirst({
    where: { OR: [{ userId: id }, { id }] },
  });
}

export function publicWorkerId(worker: { id: string; userId: string | null }) {
  return worker.userId ?? worker.id;
}

export async function ensureWorkerForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error("Worker not found"), { status: 404 });
  }

  const name = displayName(user);
  const existing = await prisma.clockWorker.findUnique({
    where: { userId },
  });
  if (existing) {
    if (existing.name !== name || !existing.active) {
      return prisma.clockWorker.update({
        where: { id: existing.id },
        data: { name, active: true },
      });
    }
    return existing;
  }

  return prisma.clockWorker.create({
    data: { userId, name, active: true },
  });
}

export async function listAssignableUsers(): Promise<WorkerListRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    include: {
      clockWorker: {
        include: {
          cardBindings: {
            where: { active: true },
            take: 1,
            select: { uid: true },
          },
        },
      },
    },
  });

  return users.map((user) => {
    const cw = user.clockWorker;
    return {
      id: user.id,
      name: displayName(user),
      email: user.email,
      active: cw?.active ?? false,
      createdAt: user.createdAt,
      cardUid: cw?.cardBindings?.[0]?.uid ?? null,
      clockWorkerId: cw?.id ?? null,
    };
  });
}

export async function listWorkers(): Promise<WorkerListRow[]> {
  const users = await prisma.user.findMany({
    where: {
      clockWorker: {
        cardBindings: { some: {} },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    include: {
      clockWorker: {
        include: {
          cardBindings: {
            where: { active: true },
            take: 1,
            select: { uid: true },
          },
        },
      },
    },
  });

  return users.map((user) => {
    const cw = user.clockWorker!;
    return {
      id: user.id,
      name: displayName(user),
      email: user.email,
      active: cw.active,
      createdAt: user.createdAt,
      cardUid: cw.cardBindings?.[0]?.uid ?? null,
      clockWorkerId: cw.id,
    };
  });
}

export async function deactivateWorker(userId: string) {
  const worker = await prisma.clockWorker.findUnique({
    where: { userId },
  });
  if (!worker) {
    throw Object.assign(new Error("Worker has no clock profile yet"), {
      status: 404,
    });
  }
  await prisma.$transaction([
    prisma.clockWorker.update({
      where: { id: worker.id },
      data: { active: false },
    }),
    prisma.clockCardBinding.updateMany({
      where: { workerId: worker.id, active: true },
      data: { active: false, deactivatedAt: new Date() },
    }),
  ]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    id: user.id,
    name: displayName(user),
    email: user.email,
    active: false,
    createdAt: user.createdAt,
    cardUid: null as string | null,
    clockWorkerId: worker.id,
  };
}

export async function deactivateCard(uid: string) {
  const binding = await prisma.clockCardBinding.findFirst({
    where: { uid: normalizeUid(uid), active: true },
  });
  if (!binding) {
    throw Object.assign(new Error("Active card binding not found"), {
      status: 404,
    });
  }
  await prisma.$transaction([
    prisma.clockCardBinding.update({
      where: { id: binding.id },
      data: { active: false, deactivatedAt: new Date() },
    }),
    // Unbinding a card must not block a future assignment.
    prisma.clockWorker.update({
      where: { id: binding.workerId },
      data: { active: true },
    }),
  ]);
  return { uid: binding.uid, worker_id: binding.workerId };
}

export async function listCardBindings() {
  return prisma.clockCardBinding.findMany({
    where: { active: true },
    include: { worker: true },
    orderBy: { worker: { name: "asc" } },
  });
}

export async function ensureWorkSettings() {
  const existing = await prisma.clockWorkSettings.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;
  return prisma.clockWorkSettings.create({
    data: {
      id: "default",
      shiftStart: "07:30",
      shiftEnd: "16:30",
      timezone: "Europe/Sofia",
    },
  });
}
