const SIZES = {
  xs: { icon: "w-5 h-5", text: "text-base", gap: "gap-1.5" },
  sm: { icon: "w-6 h-6", text: "text-sm", gap: "gap-2" },
  md: { icon: "w-8 h-8", text: "text-lg", gap: "gap-2.5" },
  lg: { icon: "w-11 h-11", text: "text-2xl", gap: "gap-3" },
} as const;

const WORDMARK = [
  { char: "c", color: "#C3A170" },
  { char: "c", color: "#E2483D" },
  { char: "c" },
  { char: "a" },
  { char: "r" },
  { char: "a" },
  { char: "m" },
  { char: "e" },
  { char: "l" },
  { char: "o" },
];

export default function Logo({
  size = "md",
  wordmarkClassName = "",
}: {
  size?: keyof typeof SIZES;
  wordmarkClassName?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`flex items-center ${s.gap}`}>
      <img src="/logo-dog.svg" alt="" className={`${s.icon} shrink-0`} />
      <span
        className={`font-sans font-bold ${s.text} tracking-[-0.01em] ${wordmarkClassName}`}
      >
        {WORDMARK.map(({ char, color }, i) => (
          <span key={i} style={{ color: color ?? "#fff" }}>
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
