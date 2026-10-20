-- The cafe with its default rules. Safe to run more than once.
-- No customer data here: customers are created by signing in.
insert into public.cafes (name, slug)
values ('Coffee Pause Cyprus', 'coffee-pause-cyprus')
on conflict (slug) do nothing;
