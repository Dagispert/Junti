-- Nuestra historia: la narradora cuenta todos los recuerdos del grupo, desde
-- donde empezó todo, en una sola crónica (kind 'story', periodo fijo).
alter table narrations drop constraint if exists narrations_kind_check;
alter table narrations add constraint narrations_kind_check
  check (kind in ('week', 'month', 'year', 'story'));
