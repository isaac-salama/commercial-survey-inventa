import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "platform" | "seller";
    };
  }

  interface User {
    role: "platform" | "seller";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "platform" | "seller";
    userId?: number | string;
  }
}
