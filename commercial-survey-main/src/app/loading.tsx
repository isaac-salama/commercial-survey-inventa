import { UnlockLoader } from "@/components/unlock-loader";

export default function Loading() {
  // Global route loader: centered, branded, with contrast-safe white logo.
  // See: https://nextjs.org/docs/app/api-reference/file-conventions/loading
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <UnlockLoader size={144} label="Carregando…" on="dark" />
    </div>
  );
}
