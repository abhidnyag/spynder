import type { Mode, PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";
import { toSuggestionDTO } from "./suggestion.service";

/** Recent spins for the signed-in user, newest first, optionally scoped to a mode. */
export async function getHistory(prisma: PrismaClient, mode: Mode | null | undefined, userId: string | null) {
  if (!userId) return []; // history is per-user; anonymous sessions see nothing
  const entries = await prisma.historyEntry.findMany({
    where: { userId, ...(mode ? { suggestion: { mode } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { suggestion: true },
  });

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    createdAt: e.createdAt.toISOString(),
    suggestion: toSuggestionDTO(e.suggestion),
  }));
}

export async function recordHistory(prisma: PrismaClient, suggestionId: string, action: string, userId: string | null) {
  if (!userId) throw new GraphQLError("You must be signed in.", { extensions: { code: "UNAUTHENTICATED" } });
  const entry = await prisma.historyEntry.create({
    data: { suggestionId, action, userId },
    include: { suggestion: true },
  });
  return {
    id: entry.id,
    action: entry.action,
    createdAt: entry.createdAt.toISOString(),
    suggestion: toSuggestionDTO(entry.suggestion),
  };
}

export async function clearHistory(prisma: PrismaClient, userId: string | null) {
  if (!userId) throw new GraphQLError("You must be signed in.", { extensions: { code: "UNAUTHENTICATED" } });
  await prisma.historyEntry.deleteMany({ where: { userId } });
  return true;
}
