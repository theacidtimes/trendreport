-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — calendário LATAM (MX, AR, CO, CL)
--
-- Entra junto com os mercados (lib/mercados.ts): a demanda Casio LATAM pôs
-- Casio Vintage e G-Shock rodando em México, Argentina, Colômbia e Chile. Sem
-- estas linhas a agenda dessas marcas fica em `sem_linha` — não quebra, mas o
-- radar roda só com evergreen e âncoras, e metade das vagas fica ociosa.
--
-- Cobre os domínios que as duas marcas assinam: moda, comportamento, musica,
-- massa, entretenimento, tech e o NOVO `acao`.
--
-- `acao` (esportes de ação e superação: skate, corrida, luta, outdoor) nasce
-- aqui porque o material da própria Casio põe o G-Shock nesse território —
-- atleta de skate e de MMA, evento SLS (Street League Skateboarding), desafio
-- no Strava. Em `esporte` ele perdia a vaga para o futebol de liga, que não é a
-- tribo da marca. Futebol fica em `esporte` para quem assina esporte de massa.
--
-- "Nostalgia 80 y 90" (entretenimento) vem do mesmo material: a Casio Vintage
-- trata nostalgia como pilar (collabs Stranger Things e De Volta para o Futuro,
-- console retrô), e o acervo não tinha sensor para isso.
--
-- Regras herdadas da 0041/0042, sem exceção:
--  - GLOBAIS (tenant_id null). Ângulo de marca mora no filtro de DNA do prompt;
--    nenhum termo cita relógio.
--  - termos = frase de conversa, minúscula, SEM acento, até 3 por cluster.
--  - `pais` explícito em TODA linha. Espanhol não é universal: "parche" é turma
--    na Colômbia e não quer dizer nada na Argentina.
--  - Additive-only: só inserts.
--
-- As perenes repetem o MESMO título nos quatro países de propósito: é o mesmo
-- sensor, e o que muda é o vocabulário local (tianguis / feria americana /
-- ropa de segunda / ropa americana são a mesma conversa de garimpo).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PERENES ───────────────────────────────────────────────────────────────
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  -- México
  ('moda','Estetica que regreso',    array['regreso la moda','estetica 2000','outfit retro'],              3, 'ancora','MX'),
  ('moda','Garimpo de ropa usada',   array['ropa de paca','tianguis de ropa','encontre en el tianguis'],   3, 'ancora','MX'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','MX'),
  ('moda','Tenis y sneakers',        array['tenis nuevos','lanzamiento de tenis','fila para comprar'],     2, 'ancora','MX'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','MX'),
  ('comportamento','Plan con amigos',array['plan con amigos','salir con los compas','reunion en casa'],    2, 'ancora','MX'),
  ('musica','Escena musical local',  array['corridos tumbados','concierto en cdmx','festival de musica'],  3, 'ancora','MX'),
  ('esporte','Futbol mexicano',      array['liga mx','jornada de futbol','seleccion mexicana'],            2, 'ancora','MX'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','MX'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','MX'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','MX'),
  ('acao','Aire libre',              array['senderismo','acampar','ruta en montana'],                 1, 'ancora','MX'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','MX'),
    ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','MX'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este fin de semana'],2, 'ancora','MX'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','MX'),

  -- Argentina
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','AR'),
  ('moda','Garimpo de ropa usada',   array['feria americana','ropa usada','encontre en la feria'],         3, 'ancora','AR'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','AR'),
  ('moda','Tenis y sneakers',        array['zapatillas nuevas','lanzamiento de zapatillas','fila para comprar'], 2, 'ancora','AR'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','AR'),
  ('comportamento','Plan con amigos',array['juntada con amigos','salir con amigos','previa en casa'],      2, 'ancora','AR'),
  ('musica','Escena musical local',  array['trap argentino','recital','festival de musica'],               3, 'ancora','AR'),
  ('esporte','Futbol argentino',     array['futbol argentino','superclasico','la seleccion'],              2, 'ancora','AR'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','AR'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','AR'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','AR'),
  ('acao','Aire libre',              array['senderismo','acampar','ruta en montana'],                 1, 'ancora','AR'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','AR'),
    ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','AR'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este finde'],       2, 'ancora','AR'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','AR'),

  -- Colômbia
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','CO'),
  ('moda','Garimpo de ropa usada',   array['ropa de segunda','tienda vintage','compraventa de ropa'],      3, 'ancora','CO'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','CO'),
  ('moda','Tenis y sneakers',        array['tenis nuevos','lanzamiento de tenis','fila para comprar'],     2, 'ancora','CO'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','CO'),
  ('comportamento','Plan con amigos',array['parche con amigos','plan con amigos','salir de rumba'],        2, 'ancora','CO'),
  ('musica','Escena musical local',  array['reggaeton','concierto en bogota','festival de musica'],        3, 'ancora','CO'),
  ('esporte','Futbol colombiano',    array['liga betplay','futbol colombiano','seleccion colombia'],       2, 'ancora','CO'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','CO'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','CO'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','CO'),
  ('acao','Aire libre',              array['senderismo','acampar','ruta en montana'],                 1, 'ancora','CO'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','CO'),
    ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','CO'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este fin de semana'],2, 'ancora','CO'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','CO'),

  -- Chile
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','CL'),
  ('moda','Garimpo de ropa usada',   array['ropa americana','feria de las pulgas','encontre en la feria'], 3, 'ancora','CL'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','CL'),
  ('moda','Tenis y sneakers',        array['zapatillas nuevas','lanzamiento de zapatillas','fila para comprar'], 2, 'ancora','CL'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','CL'),
  ('comportamento','Plan con amigos',array['carrete con amigos','junta con amigos','salir con amigos'],    2, 'ancora','CL'),
  ('musica','Escena musical local',  array['trap chileno','concierto en santiago','festival de musica'],   3, 'ancora','CL'),
  ('esporte','Futbol chileno',       array['futbol chileno','la roja','partido de la roja'],               2, 'ancora','CL'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','CL'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','CL'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','CL'),
  ('acao','Aire libre',              array['senderismo','acampar','ruta en montana'],                 1, 'ancora','CL'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','CL'),
    ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','CL'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este finde'],       2, 'ancora','CL'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','CL');

-- ─── DATADAS (out/2026 – jan/2027) ─────────────────────────────────────────
-- Datas de evento comercial (Buen Fin, CyberMonday) mudam ano a ano e as de
-- 2026 NÃO foram confirmadas aqui. Janela larga e peso baixo, mesma disciplina
-- do Show Rural na 0041: se estiver errada, custa pouco. Conferir e estreitar
-- quando o calendário oficial sair.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  -- México
  ('massa','Dia de Muertos',         array['dia de muertos','altar de muertos','catrina'],                 '2026-10-20','2026-11-03', 3, 'ancora','MX'),
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 2, 'ancora','MX'),
  ('massa','Buen Fin',               array['buen fin','ofertas del buen fin','que comprar en el buen fin'],'2026-11-06','2026-11-20', 2, 'ancora','MX'),
  ('musica','Corona Capital',        array['corona capital','line up','festival en cdmx'],                 '2026-11-06','2026-11-25', 1, 'ancora','MX'),
  ('esporte','Liguilla',             array['liguilla','final de la liga mx','campeon'],                    '2026-11-20','2026-12-20', 2, 'ancora','MX'),
  ('massa','Posadas y Navidad',      array['posada','regalo de navidad','intercambio de regalos'],         '2026-12-08','2026-12-26', 2, 'ancora','MX'),

  -- Argentina
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 1, 'ancora','AR'),
  ('massa','CyberMonday',            array['cybermonday','ofertas cyber','que comprar en el cyber'],       '2026-10-26','2026-11-10', 2, 'ancora','AR'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 1, 'ancora','AR'),
  ('massa','Fiestas y fin de ano',   array['regalo de navidad','amigo invisible','fin de ano'],            '2026-12-08','2027-01-02', 2, 'ancora','AR'),
  ('comportamento','Vacaciones de verano', array['vacaciones','costa atlantica','viaje con amigos'],       '2026-12-20','2027-02-15', 2, 'ancora','AR'),

  -- Colômbia
  ('massa','Halloween',              array['halloween','disfraz','dia de los ninos'],                      '2026-10-20','2026-11-01', 3, 'ancora','CO'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 2, 'ancora','CO'),
  ('massa','Novenas y Navidad',      array['novena de aguinaldos','regalo de navidad','alumbrados'],       '2026-12-01','2026-12-26', 2, 'ancora','CO'),
  ('musica','Feria de Cali',         array['feria de cali','salsa','salsodromo'],                          '2026-12-20','2026-12-31', 1, 'ancora','CO'),
  ('esporte','Finales de la liga',   array['final de la liga','liga betplay','campeon'],                   '2026-11-25','2026-12-20', 2, 'ancora','CO'),

  -- Chile
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 1, 'ancora','CL'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 2, 'ancora','CL'),
  ('massa','Fiestas y fin de ano',   array['regalo de navidad','amigo secreto','ano nuevo'],               '2026-12-08','2027-01-02', 2, 'ancora','CL'),
  ('comportamento','Vacaciones de verano', array['vacaciones','viaje al sur','panorama de verano'],        '2026-12-20','2027-02-15', 2, 'ancora','CL');
