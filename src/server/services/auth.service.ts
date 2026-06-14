import type { PrismaClient, User } from "@prisma/client";
import { GraphQLError } from "graphql";
import {
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signResetToken,
  verifyPassword,
  verifyResetToken,
} from "@/lib/auth";
import { validateEmail, validatePassword } from "@/lib/validation";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";

const badRequest = (message: string) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

/** The user fields safe to expose over the API. */
export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() };
}

export async function register(prisma: PrismaClient, emailRaw: string, password: string, nameRaw?: string | null) {
  const email = emailRaw.trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) throw badRequest(emailError);
  const passwordError = validatePassword(password);
  if (passwordError) throw badRequest(passwordError);
  if (await prisma.user.findUnique({ where: { email } })) throw badRequest("That email is already registered.");

  const user = await prisma.user.create({
    data: { email, name: nameRaw?.trim() || null, passwordHash: await hashPassword(password) },
  });
  await setAuthCookie(user.id);
  return publicUser(user);
}

export async function login(prisma: PrismaClient, emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw badRequest("Invalid email or password.");
  }
  await setAuthCookie(user.id);
  return publicUser(user);
}

export async function logout() {
  await clearAuthCookie();
  return true;
}

/**
 * Begin a password reset. We always report success so attackers can't probe which
 * emails exist. With no email transport configured, the token is returned as
 * `devToken` for local use — in production you would email a reset link instead.
 */
export async function requestPasswordReset(prisma: PrismaClient, emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (validateEmail(email)) throw badRequest("Enter a valid email address.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: true, devToken: null }; // don't reveal whether the email exists

  const token = signResetToken(user.id);
  if (isEmailConfigured()) {
    const base = process.env.APP_URL || "http://localhost:3000";
    await sendPasswordResetEmail(user.email, `${base}/profile?reset=${encodeURIComponent(token)}`);
    return { sent: true, devToken: null };
  }
  // No SMTP configured → return the token so it can be used locally.
  return { sent: true, devToken: token };
}

export async function resetPassword(prisma: PrismaClient, token: string, newPassword: string) {
  const userId = verifyResetToken(token);
  if (!userId) throw badRequest("This reset link is invalid or has expired.");
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw badRequest(passwordError);
  const exists = await prisma.user.findUnique({ where: { id: userId } });
  if (!exists) throw badRequest("This reset link is invalid or has expired.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  return true;
}
