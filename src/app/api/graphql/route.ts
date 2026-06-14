import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import type { NextRequest } from "next/server";
import { typeDefs } from "@/graphql/schema";
import { resolvers } from "@/graphql/resolvers";
import { createContext, type GraphQLContext } from "@/graphql/context";

// The single GraphQL endpoint, served from the Next.js Node runtime.
const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
  context: createContext,
});

// Wrap in clean single-arg handlers so Next.js 15's route-type check is happy.
export function GET(request: NextRequest) {
  return handler(request);
}

export function POST(request: NextRequest) {
  return handler(request);
}
