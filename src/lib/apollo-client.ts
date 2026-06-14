import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

// Browser-side client. Suggestions are intentionally uncached so every spin
// hits the server for a fresh random pick.
export function makeApolloClient() {
  return new ApolloClient({
    link: new HttpLink({ uri: "/api/graphql" }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: "network-only" },
      query: { fetchPolicy: "network-only" },
    },
  });
}
