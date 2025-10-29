export default function Loading() {
  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="flex items-center justify-between mb-10">
          <div className="h-[43px] w-[75px] bg-white/20 rounded" />
          <div className="h-9 w-28 bg-white/20 rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="h-40 bg-white/20 rounded-xl" />
          <div className="h-72 bg-white/20 rounded-xl" />
          <div className="h-72 bg-white/20 rounded-xl" />
        </div>
      </div>
    </main>
  );
}

