import { prisma } from "@/lib/prisma";
import { normalizeUid } from "@/lib/clock/serialize";

export async function listWorkers() {
  const workers = await prisma.clockWorker.findMany({
    orderBy: { name: "asc" },
    include: {
      cardBindings: {
        where: { active: true },
        take: 1,
        select: { uid: true },
      },
    },
  });
  return workers;
}

export async function createWorker(name: string) {
  return prisma.clockWorker.create({
    data: { name: name.trim() },
  });
}

export async function deactivateWorker(id: string) {
  const worker = await prisma.clockWorker.findUnique({ where: { id } });
  if (!worker) {
    throw Object.assign(new Error("Worker not found"), { status: 404 });
  }
  await prisma.$transaction([
    prisma.clockWorker.update({
      where: { id },
      data: { active: false },
    }),
    prisma.clockCardBinding.updateMany({
      where: { workerId: id, active: true },
      data: { active: false, deactivatedAt: new Date() },
    }),
  ]);
  return prisma.clockWorker.findUniqueOrThrow({ where: { id } });
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
  await prisma.clockCardBinding.update({
    where: { id: binding.id },
    data: { active: false, deactivatedAt: new Date() },
  });
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
