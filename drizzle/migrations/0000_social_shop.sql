
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  bio text default '',
  equipped_avatar_id uuid,
  coins integer not null default 0,
  banned boolean not null default false,
  last_daily_claim date,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles readable" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_banned(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where id = _user_id), false)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base text; uname text; n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  if base = '' then base := 'user'; end if;
  uname := base;
  while exists (select 1 from public.profiles where username = uname) loop
    n := n + 1; uname := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, coins)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'username', uname), 100);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price integer not null default 0,
  model_path text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.avatars to authenticated;
grant all on public.avatars to service_role;
alter table public.avatars enable row level security;
create policy "avatars readable" on public.avatars for select to authenticated using (true);
create policy "admins manage avatars" on public.avatars for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.user_avatars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  avatar_id uuid not null references public.avatars(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, avatar_id)
);
grant select on public.user_avatars to authenticated;
grant all on public.user_avatars to service_role;
alter table public.user_avatars enable row level security;
create policy "owned readable" on public.user_avatars for select to authenticated using (true);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts readable" on public.posts for select to authenticated using (true);
create policy "create own post" on public.posts for insert to authenticated with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy "delete own or admin" on public.posts for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
grant select, insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;
alter table public.likes enable row level security;
create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "like own" on public.likes for insert to authenticated with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy "unlike own" on public.likes for delete to authenticated using (auth.uid() = user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments readable" on public.comments for select to authenticated using (true);
create policy "comment own" on public.comments for insert to authenticated with check (auth.uid() = user_id and not public.is_banned(auth.uid()));
create policy "delete own comment or admin" on public.comments for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "follow own" on public.follows for insert to authenticated with check (auth.uid() = follower_id and not public.is_banned(auth.uid()));
create policy "unfollow own" on public.follows for delete to authenticated using (auth.uid() = follower_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "own messages" on public.messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "send message" on public.messages for insert to authenticated with check (auth.uid() = sender_id and not public.is_banned(auth.uid()));
alter publication supabase_realtime add table public.messages;

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  coins integer not null check (coins > 0),
  created_by uuid,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.gift_cards to authenticated;
grant all on public.gift_cards to service_role;
alter table public.gift_cards enable row level security;
create policy "admins read cards" on public.gift_cards for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- RPCs
create or replace function public.buy_avatar(_avatar_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p int; c int;
begin
  if public.is_banned(auth.uid()) then raise exception 'You are banned'; end if;
  select price into p from avatars where id = _avatar_id;
  if p is null then raise exception 'Avatar not found'; end if;
  if exists (select 1 from user_avatars where user_id = auth.uid() and avatar_id = _avatar_id) then raise exception 'You already own this avatar'; end if;
  select coins into c from profiles where id = auth.uid() for update;
  if c < p then raise exception 'Not enough coins'; end if;
  update profiles set coins = coins - p where id = auth.uid();
  insert into user_avatars (user_id, avatar_id) values (auth.uid(), _avatar_id);
end; $$;

create or replace function public.equip_avatar(_avatar_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _avatar_id is not null and not exists (select 1 from user_avatars where user_id = auth.uid() and avatar_id = _avatar_id) then
    raise exception 'You do not own this avatar'; end if;
  update profiles set equipped_avatar_id = _avatar_id where id = auth.uid();
end; $$;

create or replace function public.claim_daily()
returns integer language plpgsql security definer set search_path = public as $$
declare last date;
begin
  if public.is_banned(auth.uid()) then raise exception 'You are banned'; end if;
  select last_daily_claim into last from profiles where id = auth.uid() for update;
  if last is not null and last >= current_date then raise exception 'Already claimed today'; end if;
  update profiles set coins = coins + 50, last_daily_claim = current_date where id = auth.uid();
  return 50;
end; $$;

create or replace function public.redeem_gift_card(_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare card gift_cards;
begin
  if public.is_banned(auth.uid()) then raise exception 'You are banned'; end if;
  select * into card from gift_cards where code = upper(trim(_code)) for update;
  if card.id is null then raise exception 'Invalid code'; end if;
  if card.redeemed_by is not null then raise exception 'This code was already used'; end if;
  update gift_cards set redeemed_by = auth.uid(), redeemed_at = now() where id = card.id;
  update profiles set coins = coins + card.coins where id = auth.uid();
  return card.coins;
end; $$;

create or replace function public.admin_gift_coins(_user_id uuid, _amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  update profiles set coins = greatest(0, coins + _amount) where id = _user_id;
end; $$;

create or replace function public.admin_set_admin(_user_id uuid, _make boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _make then
    insert into user_roles (user_id, role) values (_user_id, 'admin') on conflict do nothing;
  else
    if _user_id = auth.uid() then raise exception 'You cannot remove your own admin'; end if;
    delete from user_roles where user_id = _user_id and role = 'admin';
  end if;
end; $$;

create or replace function public.admin_set_ban(_user_id uuid, _banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot ban yourself'; end if;
  update profiles set banned = _banned where id = _user_id;
end; $$;

create or replace function public.admin_create_gift_card(_coins int)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _coins <= 0 then raise exception 'Coins must be positive'; end if;
  c := upper(substr(md5(gen_random_uuid()::text),1,4) || '-' || substr(md5(gen_random_uuid()::text),1,4) || '-' || substr(md5(gen_random_uuid()::text),1,4));
  insert into gift_cards (code, coins, created_by) values (c, _coins, auth.uid());
  return c;
end; $$;

revoke execute on function public.buy_avatar, public.equip_avatar, public.claim_daily, public.redeem_gift_card, public.admin_gift_coins, public.admin_set_admin, public.admin_set_ban, public.admin_create_gift_card from public, anon;
grant execute on function public.buy_avatar, public.equip_avatar, public.claim_daily, public.redeem_gift_card, public.admin_gift_coins, public.admin_set_admin, public.admin_set_ban, public.admin_create_gift_card to authenticated;

-- storage
create policy "auth read avatar models" on storage.objects for select to authenticated using (bucket_id = 'avatar-models');
create policy "admin upload avatar models" on storage.objects for insert to authenticated with check (bucket_id = 'avatar-models' and public.has_role(auth.uid(),'admin'));
create policy "admin delete avatar models" on storage.objects for delete to authenticated using (bucket_id = 'avatar-models' and public.has_role(auth.uid(),'admin'));
