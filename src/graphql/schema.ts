import gql from "graphql-tag";

// GraphQL contract shared by the Apollo server and client operations.
export const typeDefs = gql`
  enum Mode {
    MUSIC
    MOVIE
    BOOK
  }

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String!
  }

  type ResetRequestResult {
    sent: Boolean!
    "Dev-only: reset token returned because no email transport is configured."
    devToken: String
  }

  type Suggestion {
    id: ID!
    mode: Mode!
    source: String!
    type: String
    title: String!
    artist: String
    year: Int
    rating: Float
    runtime: String
    synopsis: String
    genres: [String!]!
    vibes: [String!]!
    providers: [String!]!
    url: String
    imageUrl: String
    previewUrl: String
    trailerUrl: String
    "Movies/series only — director (or series creator) and top-billed cast."
    director: String
    cast: [String!]
    "Whether the signed-in user has favourited this suggestion."
    isFavorite: Boolean!
  }

  type HistoryEntry {
    id: ID!
    action: String!
    createdAt: String!
    suggestion: Suggestion!
  }

  "Optional filters; an empty filter yields a fully random pick."
  input SuggestionFilter {
    type: String
    genres: [String!]
    vibes: [String!]
    query: String
  }

  type Query {
    "The currently signed-in user, or null."
    me: User
    "Return one random suggestion for the mode, narrowed by the optional filter."
    randomSuggestion(mode: Mode!, filter: SuggestionFilter): Suggestion
    "Recent spins for the signed-in user, newest first, optionally limited to one mode."
    history(mode: Mode): [HistoryEntry!]!
    "The signed-in user's favourited suggestions."
    favorites(mode: Mode): [Suggestion!]!
  }

  type Mutation {
    register(email: String!, password: String!, name: String): User!
    login(email: String!, password: String!): User!
    logout: Boolean!
    "Start a password reset. Always succeeds; returns a dev token when no email is set up."
    requestPasswordReset(email: String!): ResetRequestResult!
    "Complete a password reset with the token from requestPasswordReset."
    resetPassword(token: String!, newPassword: String!): Boolean!
    "Record an action (saved/skipped) the user took on a suggestion. Requires auth."
    recordHistory(suggestionId: ID!, action: String!): HistoryEntry!
    clearHistory: Boolean!
    "Add/remove a suggestion from the user's favourites; returns the new state."
    toggleFavorite(suggestionId: ID!): Boolean!
  }
`;
