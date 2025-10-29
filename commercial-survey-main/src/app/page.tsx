import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (role === "platform") {
    redirect("/platform");
  }
  if (role === "seller") {
    redirect("/seller/home");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#3135ef] text-white">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  );
}
