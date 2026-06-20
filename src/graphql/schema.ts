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

  "A streaming service plus a direct deep link to this title on it."
  type WatchLink {
    name: String!
    url: String!
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
    "Region-specific where-to-watch link for the providers (movies/series)."
    providerUrl: String
    "Direct per-platform deep links into each streaming service (movies/series)."
    watchLinks: [WatchLink!]!
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
    "MUSIC sub-genre labels (e.g. Punk Rock, Synth-pop) that narrow the music spin."
    subgenres: [String!]
    vibes: [String!]
    query: String
    "Start years of the decades to restrict to, e.g. [1990, 2010]. Any of them may match."
    decades: [Int!]
    "Deprecated single-decade form; superseded by decades. Still honoured if sent."
    decade: Int
    "Minimum rating on the mode's native scale (movies/series 0–10, books 0–5)."
    minRating: Float
    "ISO 3166-1 region/country code: TMDB origin country, Spotify market, or book language."
    country: String
  }

  type Query {
    "The currently signed-in user, or null."
    me: User
    "Return one random suggestion for the mode, narrowed by the optional filter. region (ISO 3166-1 country code) tailors movie/series streaming providers to the viewer's country."
    randomSuggestion(mode: Mode!, filter: SuggestionFilter, region: String): Suggestion
    "Lazily-resolved 30-sec Spotify preview mp3 for a music suggestion; null when none exists."
    trackPreview(id: ID!): String
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
