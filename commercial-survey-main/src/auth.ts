import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { withPlatformDb } from "./db/client";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  // Keep Node.js runtime in route for bcrypt compatibility
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;

        const result = await withPlatformDb((db) =>
          db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
        );
        const user = result[0];
        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          // include role and id to seed JWT on first sign-in
          role: user.role,
          userId: user.id,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // Persist role to JWT when available (on sign-in)
      if (user) {
        if ("role" in user) token.role = (user as { role: "platform" | "seller" }).role;
        if ("userId" in user) token.userId = (user as { userId: number | string }).userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.role) session.user.role = token.role as "platform" | "seller";
        if (token.userId) session.user.id = String(token.userId);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        // Update last login timestamp for the user
        if (!user?.email) return;
        const email = user.email!; // narrowed by guard above
        await withPlatformDb((db) =>
          db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.email, email))
        );
      } catch {
        // Best-effort; ignore errors to avoid blocking sign-in
      }
    },
  },
};

export type AppAuthOptions = typeof authOptions;
