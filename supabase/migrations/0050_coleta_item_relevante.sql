-- RELEVÂNCIA DO ACERVO PARA A MARCA
--
-- O acervo guarda a coleta inteira do report, e a busca das redes é solta:
-- termo amplo ("segunda safra", "tecnologia") devolve vídeo de casal, cripto,
-- post de Enem. O report não sofre com isso (o modelo escolhe uns 15 itens),
-- mas a tela "Montar report" lista o acervo cru e a marca de agro via meme de
-- relacionamento como se fosse dela.
--
-- Cada item passa por um classificador (lib/relevancia.ts) que diz se ele tem
-- a ver com o negócio, a categoria, o território ou o público da marca.
--   true  = ligado à marca, aparece no Montar
--   false = ruído da busca, fica fora do Montar (o editor ainda vê)
--   null  = ainda não classificado (linha antiga ou classificação que falhou);
--           aparece, pra uma falha do classificador não esvaziar o acervo.
--
-- Linhas antigas são classificadas pelo workflow "Acervo — Relevância".

alter table public.coleta_item add column relevante boolean;

create index coleta_item_marca_relevante_idx
  on public.coleta_item (marca_id, coletado_em desc)
  where relevante is not false;
