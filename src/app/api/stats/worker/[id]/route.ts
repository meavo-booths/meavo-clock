import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { currentMonth, getWorkerMonthlySummary } from "@/lib/clock/stats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const month = req.nextUrl.searchParams.get("month") || (await currentMonth());
    const summary = await getWorkerMonthlySummary(id, month);
    if (!summary) {
      return Response.json({ error: "Worker not found" }, { status: 404 });
    }
    return Response.json(summary);
  } catch (err) {
    return jsonError(err);
  }
}
