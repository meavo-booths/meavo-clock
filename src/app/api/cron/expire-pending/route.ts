import { NextRequest } from "next/server";
import { expirePendingUids } from "@/lib/clock/pending";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const n = await expirePendingUids();
  return Response.json({ expired: n });
}
