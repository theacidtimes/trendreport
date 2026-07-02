import type { Tendencia } from "@/lib/types";

const STATUS_LABEL: Record<Tendencia["status"], string> = {
  em_alta: "EM ALTA",
  subindo: "SUBINDO",
  estabilizando: "ESTABILIZANDO",
  esfriando: "ESFRIANDO",
};

function StatusBadge({ status }: { status: Tendencia["status"] }) {
  const base =
    "inline-block px-3 py-1 rounded-full text-xs uppercase font-medium tracking-wide w-fit";

  if (status === "em_alta") {
    return (
      <span className={`${base} bg-lime text-black`}>
        {STATUS_LABEL[status]}
      </span>
    );
  }

  if (status === "subindo") {
    return (
      <span className={`${base} bg-purple text-white`}>
        {STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <span className={`${base} border border-muted text-muted`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function TrendCard({
  tendencia,
  large = false,
}: {
  tendencia: Tendencia;
  large?: boolean;
}) {
  const hasImage = Boolean(tendencia.imagem_url);

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col justify-end p-6 gap-3 ${
        large ? "min-h-[420px]" : "min-h-[200px]"
      } ${hasImage ? "" : "bg-surface"}`}
      style={
        hasImage
          ? {
              backgroundImage: `url(${tendencia.imagem_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {hasImage && (
        <div className="absolute inset-0 bg-purple-mid/65" aria-hidden />
      )}

      <div className="relative flex flex-col gap-3">
        <StatusBadge status={tendencia.status} />

        <h3
          className={`font-bold text-white ${
            large ? "text-4xl" : "text-2xl"
          }`}
        >
          {tendencia.titulo}
        </h3>

        <p className="text-muted text-lg">{tendencia.descricao}</p>

        <p className="text-lime italic">{tendencia.gancho_produto}</p>

        {tendencia.post_url && (
          <a
            href={tendencia.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-xs uppercase tracking-wide font-medium border border-white/30 rounded-lg px-4 py-2 w-fit hover:border-lime transition-colors"
          >
            VER POST →
          </a>
        )}
      </div>
    </div>
  );
}
