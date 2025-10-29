import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import SellerWizard from "../seller-wizard";
import { withSellerDb } from "@/db/client";
import { sellerProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerFeatureFlags } from "@/config/features";
import BackButton from "@/app/back-button";

export default async function SellerIndexPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect("/");
  }

  if (role !== "seller") {
    if (role === "platform") redirect("/platform");
    redirect("/");
  }

  const { lockResultsNav } = getServerFeatureFlags();
  // Determine if this seller has completed the assessment (reached results)
  // Only force Results when the feature is enabled
  let resultsOnly = false;
  try {
    const sellerId = Number(session.user.id);
    if (Number.isFinite(sellerId) && sellerId > 0) {
      const rows = await withSellerDb(sellerId, (db) =>
        db
          .select({ reachedStep8: sellerProgress.reachedStep8, lastStepOrder: sellerProgress.lastStepOrder })
          .from(sellerProgress)
          .where(eq(sellerProgress.sellerId, sellerId))
          .limit(1)
      );
      const progress = rows[0];
      if (lockResultsNav && progress && (progress.reachedStep8 || (progress.lastStepOrder ?? 0) >= 8)) {
        resultsOnly = true;
      }
    }
  } catch {
    // If anything goes wrong, default to normal flow; server actions still guard.
  }

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Image
            src="/unlock-minal-logo-branco.svg"
            alt="Unlock logo"
            width={75}
            height={43}
          />
          <BackButton />
        </div>
        <SellerWizard resultsOnly={resultsOnly} lockResultsNav={lockResultsNav} />
      </div>
    </main>
  );
}

