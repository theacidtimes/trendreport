import { createClient } from "@supabase/supabase-js";
import * as yaml from "js-yaml";
import { generateReport } from "../lib/generateReport";

async function main() {
  const slug = process.env.REPORT_SLUG;
  const briefingYaml = process.env.BRIEFING_YAML;

  if (!slug || !briefingYaml) {
    throw new Error("REPORT_SLUG e BRIEFING_YAML são obrigatórios.");
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const briefing = yaml.load(briefingYaml) as Record<string, unknown>;
    const result = await generateReport(briefingYaml, briefing);

    if ("error" in result) {
      await supabase
        .from("reports")
        .update({ status: "error", error_message: result.error })
        .eq("slug", slug);
      console.error("Geração falhou:", result.error);
      return;
    }

    const { error: updateError } = await supabase
      .from("reports")
      .update({ status: "ready", report: result.report })
      .eq("slug", slug);

    if (updateError) {
      throw new Error(`Falha ao salvar report no Supabase: ${updateError.message}`);
    }

    console.log(`Report ${slug} gerado com sucesso.`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await supabase
      .from("reports")
      .update({ status: "error", error_message: `Erro inesperado ao gerar relatório: ${detail}` })
      .eq("slug", slug);
    console.error("Erro inesperado:", detail);
    process.exitCode = 1;
  }
}

main();
