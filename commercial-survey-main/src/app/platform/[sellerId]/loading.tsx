import { UnlockLoader } from "@/components/unlock-loader";

export default function Loading() {
  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <UnlockLoader size={144} label="Carregando vendedor…" on="dark" />
        </div>
      </div>
    </main>
  );
}

