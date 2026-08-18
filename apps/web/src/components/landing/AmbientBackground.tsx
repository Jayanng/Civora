/** Static ambient backdrop: a faint graph-paper grid + soft green glow. Decoration only. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(23,25,28,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,25,28,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[480px]"
        style={{ background: "radial-gradient(640px 320px at 50% 0%, rgba(45,106,79,0.10), transparent 70%)" }}
      />
    </div>
  );
}
