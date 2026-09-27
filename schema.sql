create table if not exists employees (
  id text primary key,
  name text not null,
  role text not null check (role in ('manager', 'salesperson', 'expense_reporter')),
  telegram_user_id text unique,
  telegram_chat_id text
);

create table if not exists transactions (
  reference text primary key,
  type text not null check (type in ('sale', 'expense')),
  submitted_by text not null references employees(id),
  submitted_at timestamptz not null default now(),
  source text not null check (source in ('website', 'telegram')),
  telegram_chat_id text,
  status text not null,
  payload jsonb not null,
  decision jsonb,
  sheet_sync_status text not null default 'not_configured',
  sheet_sync_error text,
  notification_status text not null default 'not_required',
  notification_error text,
  updated_at timestamptz not null default now()
);

create index if not exists transactions_submitted_by_idx on transactions(submitted_by);

insert into employees (id, name, role) values
  ('svetlana', 'Svetlana de Monte Carlo', 'manager'),
  ('richard', 'Richard Call Me Dick Darling', 'salesperson'),
  ('anastasia', 'Anastasia Ferrari', 'salesperson'),
  ('jeanclaude', 'Jean Claude Bērziņš', 'salesperson'),
  ('kevin', 'Kevin von Whatever', 'expense_reporter')
on conflict (id) do update set name = excluded.name, role = excluded.role;
