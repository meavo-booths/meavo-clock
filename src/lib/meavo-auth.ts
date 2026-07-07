import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CLOCK_TOOL_CARD_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function requireClockAccess() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const access = await prisma.toolCardAccess.findFirst({
    where: { userId: session.user.id, cardId: CLOCK_TOOL_CARD_ID },
  });

  if (!access) redirect("/login?error=NoAccess");

  return session;
}
