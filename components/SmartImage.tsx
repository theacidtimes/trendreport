"use client";

import { useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";

// URLs de imagem das redes (fbcdn, tiktok cdn etc.) são assinadas e expiram —
// quando isso acontece o <img> renderiza um quadro quebrado. Aqui capturamos o
// onError e trocamos por um ícone padrão, em vez de deixar o espaço vazio.
export default function SmartImage({
  src,
  alt = "",
  className,
  wrapperClassName = "absolute inset-0 flex items-center justify-center",
  fallback,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={wrapperClassName}>
        {fallback ?? <ImageOff className="w-8 h-8 text-white/25" strokeWidth={1.5} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
