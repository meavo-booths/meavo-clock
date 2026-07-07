import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { createWorker, listWorkers } from "@/lib/clock/workers";
import { toWorkerRow } from "@/lib/clock/serialize";

export async function GET() {
  try {
    await requireAdminApi();
    const workers = await listWorkers();
    return Response.json(workers.map(toWorkerRow));
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminApi();
    const body = await req.json();
    if (!body.name?.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const worker = await createWorker(body.name);
    return Response.json(toWorkerRow(worker), { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
