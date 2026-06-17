"use client";

import { useState } from "react";
import { ApolloProvider } from "@apollo/client";
import { makeApolloClient } from "@/lib/apollo-client";
import { ModeProvider } from "@/context/ModeContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeApolloClient);
  return (
    <ApolloProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <ModeProvider>{children}</ModeProvider>
        </AuthProvider>
      </ThemeProvider>
    </ApolloProvider>
  );
}
