"use client";

import { useState } from "react";
import BriefingForm from "@/components/BriefingForm";
import BriefingAssistant from "@/components/briefing/BriefingAssistant";
import {
  applyBriefingPatch,
  briefingFields,
  useBriefingState,
} from "@/components/briefing/useBriefingState";

// Junta o formulário (esquerda) e o copiloto (direita) num só estado. O que a
// analista responde no chat vira patch e aparece na hora nos campos do form.
export default function BriefingComposer({
  onLoadingChange,
}: {
  onLoadingChange?: (loading: boolean) => void;
}) {
  const s = useBriefingState();
  const [loading, setLoading] = useState(false);

  function handleLoading(next: boolean) {
    setLoading(next);
    onLoadingChange?.(next);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      <BriefingForm state={s} onLoadingChange={handleLoading} />
      {/* Copiloto fixo: acompanha a rolagem enquanto a analista vê os campos
          sendo preenchidos à esquerda (mesmo espírito do painel do mapa). */}
      <div className="lg:sticky lg:top-6 self-start">
        <BriefingAssistant
          fields={briefingFields(s)}
          applyPatch={(p) => applyBriefingPatch(s, p)}
          disabled={loading}
        />
      </div>
    </div>
  );
}
