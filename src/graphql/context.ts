import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export interface GraphQLContext {
  prisma: typeof prisma;
  user: User | null;
}

/** Resolve the signed-in user (if any) from the auth cookie for every request. */
export const createContext = async (): Promise<GraphQLContext> => {
  let user: User | null = null;
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const userId = token ? verifyToken(token) : null;
    if (userId) user = await prisma.user.findUnique({ where: { id: userId } });
  } catch {
    /* cookies() unavailable outside a request scope */
  }
  return { prisma, user };
};
