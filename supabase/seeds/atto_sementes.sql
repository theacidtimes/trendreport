-- Atto Sementes (ex-Sementes Adriana). Dado de tenant, nao migration: roda uma
-- vez, na mao, no tenant Caramelo.
--
-- Fonte: pasta "Planejamento" do Drive (diagnostico de marca ago/2026, Mapa de
-- Mensagens/Midia/Potencial Regional, Recall e NPS Kynetec 2026, TGI Brasil 2026
-- R1, AgriHub/SENAR-MT). Posicionamento vendido: SEEDTECH — "Atto, tecnologia
-- que vem de dentro" (algoritmo + testes multidimensionais + genetica original),
-- NAO agro tradicional.
--
-- Nasce com status_varredura = false: cadastrada, sem gastar credito ate o DNA
-- ser revisado. Para ligar: update marcas set status_varredura = true where nome = 'Atto Sementes';
insert into public.marcas (nome, tenant_id, status_varredura, intervalo_horas, yaml_conhecimento) values
  ('Atto Sementes', '61863470-3633-4de9-804e-1fb4a2ae6311', false, 72, '{
    "marca": "Atto Sementes",
    "pais": "BR",
    "idioma": "pt",
    "produto": "Seedtech brasileira (ex-Sementes Adriana). Soja (linhas EVO e ATTO, indice de vigor proprietario IPA, garantia Protege, tratamento Escud, portfolio multigenetico Formula) e sementes de 2a safra e forrageiras: Milhetos Graniferos (ADRG 9060/9070), ADR300 e ADR500 Super Massa, Valente (milheto silageiro), Braquiaria e Crotalaria de pureza maxima. Diferencial: tecnologia proprietaria (algoritmo exclusivo + testes multidimensionais) que projeta a integridade da semente no plantio; genetica original que a copia pirata nao replica.",
    "tom": "Tecnico e direto, de quem mostra o processo e fecha em resultado (R$/ha, sc/ha, estande). Prova antes de promessa. Seedtech, nao agro de porteira: ciencia e rigor sem jargao de startup.",
    "perfil_comportamental": "Produtor rural e agronomo de MT, GO, MS, MATOPIBA e Sul/Sudeste na pecuaria. Decide por produtividade e custo por hectare; 70% sao conservadores ou pragmaticos e so adotam com prova de campo e indicacao de quem conhece. Digital e rotina (95% na internet, WhatsApp, YouTube) mas cauteloso: 52% verificam fonte antes de confiar. Consome financas, sustentabilidade e automoveis acima da media; reclama de campanha que usa esporte em vez de lavoura. Pressionado em 2026 por credito rural apertado, replantio, pirataria de semente e custo do insumo.",
    "universos_culturais": ["Ciencia e tecnologia de semente: vigor, germinacao, genetica, testes de laboratorio", "Agtech e agricultura de precisao", "Agricultura regenerativa, saude do solo, palhada e ILP", "Economia da fazenda: custo por hectare, saca, credito rural, margem", "Pecuaria intensiva: silagem, confinamento, reforma de pastagem", "Rastreabilidade, originalidade e combate a pirataria", "Dia de campo, feiras e cooperativas como lugar de prova", "Caminhonete, pescaria e vida de fazenda sem cliche"],
    "ambicao_de_marca": "Ser a seedtech brasileira: a semente cuja tecnologia vem de dentro, com prova de processo que o pirata nao copia e retorno em R$/ha que o produtor consegue conferir.",
    "o_que_evitar": ["meme e viral de massa", "pauta politica do agro", "debate de agrotoxico", "especulacao de preco", "agro raiz de cliche: sertanejo, rodeio, trator vermelho, chapeu de peao", "esporte de alta performance como analogia (campanha 2026 foi criticada: produtor quer lavoura e produto no centro)", "tecnologia como discurso abstrato ou ficcao cientifica: inovacao so aparece como ferramenta de produtividade e prova", "promessa de produtividade sem numero e sem fonte", "culpar o produtor pela crise de credito ou fazer graca com endividamento", "atacar concorrente pelo nome", "silenciar Sementes Adriana de vez: manter co-branding enquanto a unificacao nao fechar"],
    "termos_busca": ["Atto Sementes", "Sementes Adriana", "ADR300", "ADR500 Super Massa", "milheto granifero", "Valente milheto silagem", "Protege Atto", "semente de soja Atto"],
    "termos_culturais": ["vigor da semente", "germinacao baixa", "replantio", "semente pirata", "custo por hectare", "janela de plantio", "segunda safra", "palhada", "nematoide na soja", "silagem barata", "reforma de pastagem", "credito rural", "dia de campo", "solo vivo", "produtividade da soja", "plantio direto"],
    "termos_culturais_en": ["seed technology", "agtech", "regenerative agriculture", "soil health", "seed genetics", "precision agriculture", "crop rotation", "brazil soybean"],
    "linkedin_ativo": true,
    "termos_linkedin": ["tecnologia de sementes", "agtech brasil", "agricultura regenerativa", "biotecnologia agricola", "pesquisa agropecuaria", "melhoramento genetico"],
    "youtube_ativo": true,
    "termos_youtube": ["vigor da semente de soja", "milheto granifero segunda safra", "silagem de milheto valente", "semente pirata ADR300", "dia de campo soja"],
    "dominios_culturais": ["agro", "clima", "economia", "tech"],
    "peso_cultural": 0.35,
    "perfil_cultural_manual": true,
    "justificativa_cultural": "Escolha MANUAL (23/10/2026). Marca category-led, B2B2C rural, que vende posicionamento seedtech. `agro` traz o calendario de safra (plantio, vazio sanitario, feiras); `clima` cobre geada/seca/chuva que decidem replantio; `economia` cobre preco da saca, credito e dolar (TGI: afinidade 145); `tech` ancora a leitura seedtech e agtech. Fora de proposito: massa/entretenimento/esporte (diagnostico mostrou que a analogia esportiva esfriou a marca e o produtor pediu lavoura). Peso baixo: o gancho da Atto e prova tecnica, nao carona em cultura pop. 4 de 6 vagas."
  }'::jsonb)
returning id, nome, status_varredura, intervalo_horas;
