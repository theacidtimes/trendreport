const SIZES = {
  sm: { mark: "w-8 h-8", text: "text-sm", gap: "gap-2" },
  md: { mark: "w-10 h-10", text: "text-lg", gap: "gap-2.5" },
  lg: { mark: "w-12 h-12", text: "text-2xl", gap: "gap-3" },
} as const;

// Marca do console ACID — o Acid Fabric é o produto da ACID (não do tenant).
// Usa o vetor da marca (public/fabric-mark.svg). Distinto do <Logo> white-label
// do workspace, que carrega a marca do tenant. `wordmark={false}` mostra só o
// símbolo (ex.: canto do login, no estilo Krea).
export default function AcidLogo({
  size = "md",
  wordmark = true,
}: {
  size?: keyof typeof SIZES;
  wordmark?: boolean;
}) {
  const s = SIZES[size];
  return (
    <span className={`flex items-center ${s.gap}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fabric-mark.svg"
        alt="Acid Fabric"
        className={`shrink-0 object-contain ${s.mark}`}
      />
      {wordmark && (
        <span className={`font-sans font-bold tracking-[-0.01em] ${s.text}`}>
          <span className="text-white">Acid</span>
          <span className="text-purple"> Fabric</span>
        </span>
      )}
    </span>
  );
}
