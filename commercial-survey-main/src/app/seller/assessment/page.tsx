import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import BackButton from "../../back-button";
import AssessmentForm from "./assessment-form";

export default async function SellerAssessmentPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) redirect("/");
  if (role !== "seller") {
    if (role === "platform") redirect("/platform");
    redirect("/");
  }

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header: logo + logout */}
        <div className="flex items-center justify-between mb-10">
          <Image src="/unlock-minal-logo-branco.svg" alt="Unlock logo" width={75} height={43} priority />
          <BackButton />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold mb-6">
          Complete sua avaliação para que possamos coletar as informações necessárias para elaborar uma proposta de colaboração personalizada, ajustada às suas necessidades.
        </h1>

        {/* Assessment Form */}
        <AssessmentForm />
      </div>
    </main>
  );
}
