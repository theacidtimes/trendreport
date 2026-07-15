-- WI-0 (Acid Fabric): liga report a uma marca, pra o gerador beber do
-- yaml_conhecimento da marca (fonte única) em vez do VIVO_KNOWLEDGE hardcoded.
-- Aditivo e nullable: reports existentes ficam com marca_id = null e caem no
-- fallback do gerador (comportamento atual preservado). Nada de radar é tocado.
alter table reports
  add column marca_id uuid references marcas(id) on delete set null;

create index reports_marca_id_idx on reports(marca_id);
