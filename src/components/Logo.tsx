export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <circle cx="18" cy="18" r="16" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 26 L32 10" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="18" cy="18" r="4" className="fill-primary" />
      </svg>
      <span className="text-lg tracking-[0.25em]">
        <b className="font-bold">ARES</b> <span className="opacity-70">IMÓVEIS</span>
      </span>
    </div>
  );
}
