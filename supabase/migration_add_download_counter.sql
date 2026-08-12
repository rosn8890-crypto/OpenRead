-- Migration: adds the download counter used by the new "Download book"
-- button in the reader. Safe to run even if you already ran schema.sql
-- before this feature existed — it only adds one new function.
--
-- Run this once in Supabase → SQL Editor.

create function public.increment_download_count(book_id uuid)
returns void as $$
begin
  update public.books set download_count = download_count + 1 where id = book_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_download_count(uuid) to authenticated;
