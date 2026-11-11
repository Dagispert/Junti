-- Junti · ciudad de residencia con coordenadas
--
-- La ciudad se elige de un buscador y se guardan sus coordenadas, a nivel de
-- ciudad (nunca la ubicación exacta), para situar a cada integrante en el mapa.
-- Como el resto del perfil, solo la ven las personas que comparten grupo.

alter table profiles
  add column home_lat double precision check (home_lat between -90 and 90),
  add column home_lng double precision check (home_lng between -180 and 180);
