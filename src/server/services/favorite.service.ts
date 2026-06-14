import type { Mode, PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";
import { toSuggestionDTO } from "./suggestion.service";

const requireAuth = (userId: string | null): string => {
  if (!userId) throw new GraphQLError("You must be signed in.", { extensions: { code: "UNAUTHENTICATED" } });
  return userId;
};

/** Toggle a suggestion in the user's favourites; returns the new favourited state. */
export async function toggleFavorite(prisma: PrismaClient, suggestionId: string, userIdRaw: string | null) {
  const userId = requireAuth(userIdRaw);
  const existing = await prisma.favorite.findUnique({ where: { userId_suggestionId: { userId, suggestionId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.favorite.create({ data: { userId, suggestionId } });
  return true;
}

export async function isFavorite(prisma: PrismaClient, suggestionId: string, userId: string | null) {
  if (!userId) return false;
  return Boolean(await prisma.favorite.findUnique({ where: { userId_suggestionId: { userId, suggestionId } } }));
}

/** The user's favourited suggestions, newest first, optionally scoped to a mode. */
export async function getFavorites(prisma: PrismaClient, mode: Mode | null | undefined, userId: string | null) {
  if (!userId) return [];
  const rows = await prisma.favorite.findMany({
    where: { userId, ...(mode ? { suggestion: { mode } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { suggestion: true },
  });
  return rows.map((r) => toSuggestionDTO(r.suggestion));
}
