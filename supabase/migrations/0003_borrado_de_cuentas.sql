-- Junti · permitir borrar cuentas
--
-- Borrar una cuenta fallaba si esa persona había creado un grupo o una invitación.
-- Ahora el grupo sobrevive sin «creador» (sigue siendo de sus integrantes) y las
-- invitaciones de esa persona desaparecen con ella.

alter table groups alter column created_by drop not null;
alter table groups drop constraint groups_created_by_fkey;
alter table groups add constraint groups_created_by_fkey
  foreign key (created_by) references profiles (id) on delete set null;

alter table invitations drop constraint invitations_created_by_fkey;
alter table invitations add constraint invitations_created_by_fkey
  foreign key (created_by) references profiles (id) on delete cascade;
