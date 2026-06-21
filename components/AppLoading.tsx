
export default function AppLoading() {
  return (
    <main
      className="min-h-screen p-4"
      style={{
        background: "var(--background)",
      }}
    >
      <div className="animate-pulse space-y-5">

        <div
          className="h-14 rounded-2xl"
          style={{
            background: "var(--card-bg)",
          }}
        />

        <div className="flex gap-3 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 min-w-[90px] rounded-2xl"
              style={{
                background: "var(--card-bg)",
              }}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-[28px]"
              style={{
                background: "var(--card-bg)",
              }}
            />
          ))}
        </div>

      </div>
    </main>
  );
}
