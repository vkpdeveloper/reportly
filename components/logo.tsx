// Same mark as app/icon.svg: a page whose newest line is filling in, in calm green.
// Sized in em, so the mark follows the font size of wherever the logo is placed.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.4em] font-semibold text-ink ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-[1.2em] shrink-0">
        <rect width="32" height="32" rx="8" fill="#18181b" />
        <rect x="8" y="8" width="16" height="4" rx="2" fill="#ededee" />
        <rect x="8" y="14" width="12" height="4" rx="2" fill="#ededee" />
        <rect x="8" y="20" width="8" height="4" rx="2" fill="#8fd4b6" />
      </svg>
      Reportly
    </span>
  );
}
