import { createClient } from "@supabase/supabase-js";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const envRaw = fs.readFileSync(
    path.join(process.cwd(), ".env.local"),
    "utf-8"
  );
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }

  const slug = process.argv[2] || "74f6af5c";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from("reports")
    .select("briefing, cliente")
    .eq("slug", slug)
    .single();
  if (error || !data) {
    throw new Error(`Não achei o report ${slug}: ${error?.message}`);
  }

  const briefingYaml = yaml.dump(data.briefing);
  console.log(`Regenerando ${slug} (${data.cliente})...`);

  await supabase
    .from("reports")
    .update({ status: "pending", report: null, error_message: null, progress: null })
    .eq("slug", slug);

  process.env.SUPABASE_URL = supabaseUrl;
  process.env.REPORT_SLUG = slug;
  process.env.BRIEFING_YAML = briefingYaml;

  await import("./generate-report");
}

main().catch((err) => {
  console.error("Falhou:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
