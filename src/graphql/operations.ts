import { gql } from "@apollo/client";

// Shared fragment so every screen renders a suggestion identically.
const SUGGESTION_FIELDS = gql`
  fragment SuggestionFields on Suggestion {
    id
    mode
    source
    type
    title
    artist
    year
    rating
    runtime
    synopsis
    genres
    vibes
    providers
    providerUrl
    watchLinks {
      name
      url
    }
    url
    imageUrl
    previewUrl
    trailerUrl
    director
    cast
    isFavorite
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      email
      name
      createdAt
    }
  }
`;

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String) {
    register(email: $email, password: $password, name: $name) {
      id
      email
      name
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      name
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      sent
      devToken
    }
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

export const RANDOM_SUGGESTION = gql`
  ${SUGGESTION_FIELDS}
  query RandomSuggestion($mode: Mode!, $filter: SuggestionFilter, $region: String) {
    randomSuggestion(mode: $mode, filter: $filter, region: $region) {
      ...SuggestionFields
    }
  }
`;

export const TRACK_PREVIEW = gql`
  query TrackPreview($id: ID!) {
    trackPreview(id: $id)
  }
`;

export const HISTORY = gql`
  ${SUGGESTION_FIELDS}
  query History($mode: Mode) {
    history(mode: $mode) {
      id
      action
      createdAt
      suggestion {
        ...SuggestionFields
      }
    }
  }
`;

export const FAVORITES = gql`
  ${SUGGESTION_FIELDS}
  query Favorites($mode: Mode) {
    favorites(mode: $mode) {
      ...SuggestionFields
    }
  }
`;

export const TOGGLE_FAVORITE = gql`
  mutation ToggleFavorite($suggestionId: ID!) {
    toggleFavorite(suggestionId: $suggestionId)
  }
`;

export const RECORD_HISTORY = gql`
  mutation RecordHistory($suggestionId: ID!, $action: String!) {
    recordHistory(suggestionId: $suggestionId, action: $action) {
      id
    }
  }
`;

export const CLEAR_HISTORY = gql`
  mutation ClearHistory {
    clearHistory
  }
`;
