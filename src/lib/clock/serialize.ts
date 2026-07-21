import type {
  ClockCardBinding,
  ClockEvent,
  ClockPendingUid,
} from "@prisma/client";
import { ClockEventType, ClockPendingStatus } from "@prisma/client";

export function normalizeUid(uid: string) {
  return uid.trim().toUpperCase();
}

export function toWorkerRow(worker: {
  id: string;
  name: string;
  email?: string;
  active: boolean;
  createdAt: Date;
  cardUid?: string | null;
  cardBindings?: { uid: string }[];
  clockWorkerId?: string | null;
}) {
  return {
    id: worker.id,
    name: worker.name,
    email: worker.email ?? null,
    active: worker.active ? 1 : 0,
    created_at: worker.createdAt.toISOString(),
    card_uid: worker.cardUid ?? worker.cardBindings?.[0]?.uid ?? null,
    clock_worker_id: worker.clockWorkerId ?? null,
  };
}

export function toPendingRow(row: ClockPendingUid) {
  return {
    id: row.id,
    uid: row.uid,
    station_id: row.stationId,
    tapped_at: row.tappedAt,
    expires_at: row.expiresAt.toISOString(),
    status: row.status.toLowerCase(),
    created_at: row.createdAt.toISOString(),
  };
}

export function toEventRow(
  row: ClockEvent & { worker?: { name: string } | null },
) {
  return {
    id: row.id,
    uid: row.uid,
    worker_id: row.workerId,
    station_id: row.stationId,
    event_type: row.eventType.toLowerCase(),
    tapped_at: row.tappedAt,
    idempotency_key: row.idempotencyKey,
    created_at: row.createdAt.toISOString(),
    worker_name: row.worker?.name,
  };
}

export function toBindingRow(
  row: ClockCardBinding & { worker: { name: string } },
) {
  return {
    id: row.id,
    uid: row.uid,
    worker_id: row.workerId,
    active: row.active ? 1 : 0,
    created_at: row.createdAt.toISOString(),
    deactivated_at: row.deactivatedAt?.toISOString() ?? null,
    worker_name: row.worker.name,
  };
}

export { ClockEventType, ClockPendingStatus };
