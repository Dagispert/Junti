-- Solo para pruebas locales: simula lo mínimo de Supabase (esquema auth y rol authenticated).
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create role authenticated nologin;
grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;

-- Lo mínimo del almacén de archivos de Supabase.
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;
