"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "./Icon";

/** Top-bar avatar: the signed-in user's initial, or a sign-in icon. Links to Profile. */
export function UserAvatar() {
  const { user } = useAuth();
  const initial = user ? (user.name || user.email).charAt(0).toUpperCase() : null;

  return (
    <Link
      href="/profile"
      aria-label={user ? "Account" : "Sign in"}
      className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold transition active:scale-95 ${
        user ? "bg-accent text-white" : "border border-line text-sub"
      }`}
    >
      {initial ?? <Icon name="user" size={18} />}
    </Link>
  );
}
