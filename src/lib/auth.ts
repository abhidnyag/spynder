import "server-only";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
export const COOKIE_NAME = "spynder_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signToken = (userId: string) => jwt.sign({ sub: userId }, SECRET, { expiresIn: MAX_AGE });

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Short-lived, single-purpose token for password resets.
const RESET_MAX_AGE = 60 * 30; // 30 minutes
export const signResetToken = (userId: string) =>
  jwt.sign({ sub: userId, typ: "reset" }, SECRET, { expiresIn: RESET_MAX_AGE });

export function verifyResetToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub?: string; typ?: string };
    return payload.typ === "reset" ? (payload.sub ?? null) : null;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function setAuthCookie(userId: string) {
  (await cookies()).set(COOKIE_NAME, signToken(userId), { ...cookieOptions, maxAge: MAX_AGE });
}

export async function clearAuthCookie() {
  (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
}
