import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-api";
import { jsonError } from "@/lib/device-auth";
import { currentMonth, getWorkerMonthlyReport } from "@/lib/clock/stats";

export async function GET(req: NextRequest) {
  try {
    await requireAdminApi();
    const month = req.nextUrl.searchParams.get("month") || (await currentMonth());
    return Response.json(await getWorkerMonthlyReport(month));
  } catch (err) {
    return jsonError(err);
  }
}
