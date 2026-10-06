-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — calendário de Panamá, Peru e Uruguai
--
-- Correção da lista LATAM da Casio (05/10/2026): os países são AR, CL, CO, PA,
-- PE e UY. México NÃO entra. AR, CL e CO já têm agenda (0046); esta migration
-- traz os três que faltavam, com o mesmo desenho e as mesmas regras da 0046:
--  - GLOBAIS (tenant_id null), nenhum termo cita relógio.
--  - termos = frase de conversa, minúscula, SEM acento, até 3 por cluster.
--  - `pais` explícito em toda linha; perenes com o MESMO título dos outros
--    países (mesmo sensor, vocabulário local).
--  - Additive-only. As linhas de MX da 0046 ficam: são inertes sem marca MX
--    ativa, e apagar seria destrutivo à toa.
--
-- Datas comerciais e feriados com janela larga e peso baixo, como na 0046:
-- conferir quando o calendário oficial de cada país sair.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PERENES ───────────────────────────────────────────────────────────────
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  -- Panamá
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','PA'),
  ('moda','Garimpo de ropa usada',   array['ropa de paca','ropa americana','tienda de segunda'],           3, 'ancora','PA'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','PA'),
  ('moda','Tenis y sneakers',        array['zapatillas nuevas','lanzamiento de zapatillas','fila para comprar'], 2, 'ancora','PA'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','PA'),
  ('comportamento','Plan con amigos',array['parkear con los amigos','plan con amigos','salir con amigos'], 2, 'ancora','PA'),
  ('musica','Escena musical local',  array['reggae en espanol','concierto en panama','festival de musica'],3, 'ancora','PA'),
  ('esporte','Futbol panameno',      array['seleccion de panama','marea roja','liga panamena'],            2, 'ancora','PA'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','PA'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','PA'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','PA'),
  ('acao','Aire libre',              array['senderismo','acampar','surf en panama'],                  1, 'ancora','PA'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','PA'),
  ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','PA'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este fin de semana'],2, 'ancora','PA'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','PA'),

  -- Peru
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','PE'),
  ('moda','Garimpo de ropa usada',   array['ropa americana','ropa de segunda','pacas de ropa'],            3, 'ancora','PE'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','PE'),
  ('moda','Tenis y sneakers',        array['zapatillas nuevas','lanzamiento de zapatillas','fila para comprar'], 2, 'ancora','PE'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','PE'),
  ('comportamento','Plan con amigos',array['salir con la mancha','tono con amigos','juntada en el jato'],  2, 'ancora','PE'),
  ('musica','Escena musical local',  array['cumbia peruana','concierto en lima','festival de musica'],     3, 'ancora','PE'),
  ('esporte','Futbol peruano',       array['liga 1','seleccion peruana','la bicolor'],                     2, 'ancora','PE'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','PE'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','PE'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','PE'),
  ('acao','Aire libre',              array['trekking','acampar','surf en lima'],                      1, 'ancora','PE'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','PE'),
  ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','PE'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este fin de semana'],2, 'ancora','PE'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','PE'),

  -- Uruguai
  ('moda','Estetica que regreso',    array['volvio la moda','estetica 2000','outfit retro'],               3, 'ancora','UY'),
  ('moda','Garimpo de ropa usada',   array['feria tristan narvaja','ropa usada','feria americana'],        3, 'ancora','UY'),
  ('moda','Outfit del dia',          array['outfit del dia','como combinar','mi outfit'],                  2, 'ancora','UY'),
  ('moda','Tenis y sneakers',        array['championes nuevos','lanzamiento de championes','fila para comprar'], 2, 'ancora','UY'),
  ('comportamento','Desconectarse',  array['detox digital','dejar el celular','vivir sin redes'],          3, 'ancora','UY'),
  ('comportamento','Plan con amigos',array['juntada con amigos','asado con amigos','salir con amigos'],    2, 'ancora','UY'),
  ('musica','Escena musical local',  array['rock uruguayo','concierto en montevideo','festival de musica'],3, 'ancora','UY'),
  ('esporte','Futbol uruguayo',      array['la celeste','clasico penarol nacional','futbol uruguayo'],     2, 'ancora','UY'),
  ('acao','Skate',                   array['skate','street league','skatepark'],                    3, 'ancora','UY'),
  ('acao','Correr en la ciudad',     array['salir a correr','carrera 10k','reto en strava'],          2, 'ancora','UY'),
  ('acao','Pelea y entrenamiento',   array['mma','pelea ufc','entrenamiento de box'],                 2, 'ancora','UY'),
  ('acao','Aire libre',              array['senderismo','acampar','surf en uruguay'],                 1, 'ancora','UY'),
  ('entretenimento','Nostalgia 80 y 90', array['videojuegos retro','peliculas de los 80','consola retro'], 2, 'ancora','UY'),
  ('massa','Lo que todos comentan',  array['todo el mundo habla de','se hizo viral','trend de tiktok'],    3, 'ancora','UY'),
  ('entretenimento','Estrenos',      array['nueva serie','estreno de netflix','que ver este finde'],       2, 'ancora','UY'),
  ('tech','Celular y gadgets',       array['celular nuevo','que celular comprar','gadget util'],           2, 'ancora','UY');

-- ─── DATADAS (out/2026 – fev/2027) ─────────────────────────────────────────
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  -- Panamá
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 1, 'ancora','PA'),
  ('massa','Fiestas patrias',        array['fiestas patrias','desfile del 3 de noviembre','mes de la patria'], '2026-10-28','2026-11-30', 3, 'ancora','PA'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 2, 'ancora','PA'),
  ('massa','Fiestas y fin de ano',   array['regalo de navidad','amigo secreto','ano nuevo'],               '2026-12-08','2027-01-02', 2, 'ancora','PA'),

  -- Peru
  ('musica','Dia de la Cancion Criolla', array['cancion criolla','musica criolla','jarana'],               '2026-10-24','2026-11-01', 2, 'ancora','PE'),
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 1, 'ancora','PE'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 2, 'ancora','PE'),
  ('massa','Fiestas y fin de ano',   array['regalo de navidad','chocolatada','ano nuevo'],                 '2026-12-08','2027-01-02', 2, 'ancora','PE'),
  ('comportamento','Verano en la playa', array['playas del sur','verano en lima','viaje con amigos'],     '2026-12-20','2027-03-01', 2, 'ancora','PE'),

  -- Uruguai
  ('massa','Halloween',              array['halloween','disfraz','fiesta de halloween'],                   '2026-10-20','2026-11-01', 1, 'ancora','UY'),
  ('massa','Black Friday',           array['black friday','ofertas black friday','descuentos'],            '2026-11-20','2026-12-01', 2, 'ancora','UY'),
  ('massa','Fiestas y fin de ano',   array['regalo de navidad','amigo invisible','fin de ano'],            '2026-12-08','2027-01-02', 2, 'ancora','UY'),
  ('comportamento','Vacaciones de verano', array['punta del este','vacaciones en la costa','viaje con amigos'], '2026-12-20','2027-02-15', 2, 'ancora','UY'),
  ('massa','Carnaval y murga',       array['murga','carnaval uruguayo','desfile de llamadas'],             '2027-01-15','2027-02-28', 2, 'ancora','UY');
