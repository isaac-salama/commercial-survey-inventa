import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
// Image not used; header uses inline SVG mark
import InventaLogoMark from "@/components/inventa-logo-mark";
import LogoutButton from "../../logout-button";
import UnlockCtaCard from "./unlock-cta-card";
import { withPlatformDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function SellerHomePage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect("/");
  }

  if (role !== "seller") {
    if (role === "platform") redirect("/platform");
    redirect("/");
  }

  // Read per-seller visibility flags for home cards (platform role read-only)
  let showIndex = true;
  let showAssessment = true;
  try {
    const sellerId = Number(session.user.id);
    if (Number.isFinite(sellerId) && sellerId > 0) {
      const rows = await withPlatformDb((db) =>
        db
          .select({ showIndex: users.showIndex, showAssessment: users.showAssessment })
          .from(users)
          .where(eq(users.id, sellerId))
          .limit(1)
      );
      if (rows[0]) {
        showIndex = !!rows[0].showIndex;
        showAssessment = !!rows[0].showAssessment;
      }
    }
  } catch {
    // default to showing both if any error
  }

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Header: logo + logout */}
        <div className="flex items-center justify-between mb-10">
          <InventaLogoMark width={75} height={43} />
          <LogoutButton />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold mb-6">Bem-vindo(a) ao Portal da Inventa</h1>

        {/* CTA Cards (visibility controlled per seller) */}
        <div className="space-y-6">
          {showIndex && <UnlockCtaCard imageSrc="/card-1.png" />}
          {showAssessment && (
            <UnlockCtaCard
              imageSrc="/card-2.png"
              title="Complete seu Inventa Assessment"
              subtitle="Passe-nos as informações necessárias para que possamos elaborar uma proposta de colaboração."
              ctaText="Acessar"
              variant="alt"
              href="/seller/assessment"
            />
          )}
        </div>
      </div>
    </main>
  );
}
