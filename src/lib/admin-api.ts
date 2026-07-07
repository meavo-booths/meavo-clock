import { auth } from "@/lib/auth";
import { CLOCK_TOOL_CARD_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function requireAdminApi() {
  const session = await auth();
  if (!session?.user?.id) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  const access = await prisma.toolCardAccess.findFirst({
    where: { userId: session.user.id, cardId: CLOCK_TOOL_CARD_ID },
  });
  if (!access) {
    throw Object.assign(new Error("Access revoked"), { status: 401 });
  }
  return session;
}
