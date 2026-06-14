"use client";

import { useState } from "react";
import { ApolloProvider } from "@apollo/client";
import { makeApolloClient } from "@/lib/apollo-client";
import { ModeProvider } from "@/context/ModeContext";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeApolloClient);
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <ModeProvider>{children}</ModeProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}
