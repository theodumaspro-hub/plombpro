export function PlombProLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Wrench shape — geometric, Paul Rand-inspired */}
      <rect width="32" height="32" rx="6" fill="hsl(24, 75%, 52%)" />
      <path
        d="M10 22L16 10L22 22H10Z"
        fill="white"
        opacity="0.9"
      />
      <circle cx="16" cy="18" r="2.5" fill="hsl(24, 75%, 52%)" />
    </svg>
  );
}
