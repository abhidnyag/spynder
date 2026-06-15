import type { Mode } from "@prisma/client";
import type { GraphQLContext } from "./context";
import { getRandomSuggestion, getTrackPreview, type SuggestionFilter } from "@/server/services/suggestion.service";
import { clearHistory, getHistory, recordHistory } from "@/server/services/history.service";
import { getFavorites, isFavorite, toggleFavorite } from "@/server/services/favorite.service";
import {
  login,
  logout,
  publicUser,
  register,
  requestPasswordReset,
  resetPassword,
} from "@/server/services/auth.service";

// Resolvers stay thin: they validate inputs and delegate to the service layer.
export const resolvers = {
  Suggestion: {
    isFavorite: (parent: { id: string }, _a: unknown, ctx: GraphQLContext) =>
      isFavorite(ctx.prisma, parent.id, ctx.user?.id ?? null),
  },

  Query: {
    me: (_p: unknown, _a: unknown, ctx: GraphQLContext) => (ctx.user ? publicUser(ctx.user) : null),

    randomSuggestion: (
      _p: unknown,
      args: { mode: Mode; filter?: SuggestionFilter; region?: string },
      ctx: GraphQLContext,
    ) => getRandomSuggestion(ctx.prisma, args.mode, args.filter, ctx.user?.id ?? null, args.region),

    trackPreview: (_p: unknown, args: { id: string }) => getTrackPreview(args.id),

    history: (_p: unknown, args: { mode?: Mode }, ctx: GraphQLContext) =>
      getHistory(ctx.prisma, args.mode, ctx.user?.id ?? null),

    favorites: (_p: unknown, args: { mode?: Mode }, ctx: GraphQLContext) =>
      getFavorites(ctx.prisma, args.mode, ctx.user?.id ?? null),
  },

  Mutation: {
    register: (_p: unknown, args: { email: string; password: string; name?: string }, ctx: GraphQLContext) =>
      register(ctx.prisma, args.email, args.password, args.name),

    login: (_p: unknown, args: { email: string; password: string }, ctx: GraphQLContext) =>
      login(ctx.prisma, args.email, args.password),

    logout: () => logout(),

    requestPasswordReset: (_p: unknown, args: { email: string }, ctx: GraphQLContext) =>
      requestPasswordReset(ctx.prisma, args.email),

    resetPassword: (_p: unknown, args: { token: string; newPassword: string }, ctx: GraphQLContext) =>
      resetPassword(ctx.prisma, args.token, args.newPassword),

    recordHistory: (
      _p: unknown,
      args: { suggestionId: string; action: string },
      ctx: GraphQLContext,
    ) => recordHistory(ctx.prisma, args.suggestionId, args.action, ctx.user?.id ?? null),

    clearHistory: (_p: unknown, _a: unknown, ctx: GraphQLContext) => clearHistory(ctx.prisma, ctx.user?.id ?? null),

    toggleFavorite: (_p: unknown, args: { suggestionId: string }, ctx: GraphQLContext) =>
      toggleFavorite(ctx.prisma, args.suggestionId, ctx.user?.id ?? null),
  },
};
