-- OpenRead database schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 2. Books
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  description text,
  category text not null,
  language text default 'English',
  tags text[] default '{}',
  isbn text,
  publication_year int,
  file_path text not null,
  file_type text not null check (file_type in ('pdf', 'epub')),
  cover_url text,
  uploaded_by uuid references public.profiles(id),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  view_count int default 0,
  download_count int default 0,
  created_at timestamptz default now()
);

-- 3. Reading progress (syncs across devices)
create table public.reading_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  current_page int default 1,
  total_pages int,
  progress_percent int default 0,
  scroll_position numeric default 0,
  last_read_at timestamptz default now(),
  primary key (user_id, book_id)
);

-- 4. Bookmarks
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page int not null,
  label text,
  created_at timestamptz default now()
);

-- 5. Notes & Highlights
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page int,
  selected_text text,
  note_text text,
  type text check (type in ('note', 'highlight', 'underline')),
  created_at timestamptz default now()
);

-- 6. Reviews & Ratings
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(user_id, book_id)
);

-- 7. Reading lists
create table public.reading_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  is_public boolean default false,
  created_at timestamptz default now()
);

create table public.reading_list_items (
  list_id uuid references public.reading_lists(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (list_id, book_id)
);

-- 8. Follows (social)
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- ========== ROW LEVEL SECURITY ==========

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notes enable row level security;
alter table public.reviews enable row level security;
alter table public.reading_lists enable row level security;
alter table public.reading_list_items enable row level security;
alter table public.follows enable row level security;

-- Profiles: anyone can view, only owner can edit
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Books: approved books are public; owners see their own pending books; admins see all
create policy "Approved books are public" on public.books for select using (status = 'approved' or uploaded_by = auth.uid());
create policy "Authenticated users can upload books" on public.books for insert with check (auth.uid() = uploaded_by);
create policy "Owners or admins can update books" on public.books for update using (
  uploaded_by = auth.uid() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Reading progress: private to each user
create policy "Users manage their own reading progress" on public.reading_progress for all using (auth.uid() = user_id);

-- Bookmarks & notes: private to each user
create policy "Users manage their own bookmarks" on public.bookmarks for all using (auth.uid() = user_id);
create policy "Users manage their own notes" on public.notes for all using (auth.uid() = user_id);

-- Reviews: everyone can read, only owner can write/edit
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Users manage their own reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users update their own reviews" on public.reviews for update using (auth.uid() = user_id);

-- Reading lists: public lists visible to all, private only to owner
create policy "Public lists visible to all" on public.reading_lists for select using (is_public or user_id = auth.uid());
create policy "Users manage their own lists" on public.reading_lists for all using (auth.uid() = user_id);
create policy "List items follow list visibility" on public.reading_list_items for select using (
  exists (select 1 from public.reading_lists l where l.id = list_id and (l.is_public or l.user_id = auth.uid()))
);
create policy "Users manage items in their own lists" on public.reading_list_items for insert with check (
  exists (select 1 from public.reading_lists l where l.id = list_id and l.user_id = auth.uid())
);
create policy "Users remove items from their own lists" on public.reading_list_items for delete using (
  exists (select 1 from public.reading_lists l where l.id = list_id and l.user_id = auth.uid())
);

-- Admins can promote/demote other users' roles (regular users can still
-- only update their own profile, per the policy above).
create policy "Admins can update any profile" on public.profiles for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Follows: public
create policy "Follows are public" on public.follows for select using (true);
create policy "Users manage their own follows" on public.follows for all using (auth.uid() = follower_id);

-- ========== STORAGE BUCKETS ==========
-- Create these via Dashboard > Storage > New bucket (mark both "Public"),
-- or run:
-- insert into storage.buckets (id, name, public) values ('books', 'books', true);
-- insert into storage.buckets (id, name, public) values ('covers', 'covers', true);

-- Marking a bucket "Public" only controls READ access via public URLs.
-- Uploading (INSERT) still goes through Row Level Security on
-- storage.objects, which has no policies by default — so uploads fail
-- with "new row violates row-level security policy" until you add these:

create policy "Authenticated users can upload to books bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'books');

create policy "Authenticated users can upload to covers bucket"
on storage.objects for insert
to authenticated
with check (bucket_id = 'covers');

create policy "Anyone can read books bucket files"
on storage.objects for select
using (bucket_id = 'books');

create policy "Anyone can read covers bucket files"
on storage.objects for select
using (bucket_id = 'covers');

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== DOWNLOAD COUNTER ==========
-- Lets ANY logged-in reader bump a book's download_count by exactly 1,
-- without needing general permission to edit that book's row (which stays
-- restricted to its owner/admins). SECURITY DEFINER lets this one narrow
-- action bypass that restriction safely, since it can't do anything else.
create function public.increment_download_count(book_id uuid)
returns void as $$
begin
  update public.books set download_count = download_count + 1 where id = book_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_download_count(uuid) to authenticated;
