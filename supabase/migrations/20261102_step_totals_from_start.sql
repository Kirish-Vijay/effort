-- All-time steps only count from the day each player started (UK date of players.created_at). The Health Connect
-- sync sends yesterday as well as today, and a new phone can backfill weeks: none of that is theirs to claim, and
-- after the 2 Nov 2026 restart (created_at reset to that day) it kept the test fortnight out.
create or replace function public.step_totals(p_ids uuid[])
returns table(player_id uuid, total bigint, days int, best int, best_day date)
language sql stable set search_path = public as $$
  with d as (
    select s.player_id, s.day,
      greatest(0, s.steps - coalesce((select sum(a.steps) from step_adjust a where a.player_id = s.player_id and a.day = s.day), 0))::int as n
    from daily_steps s join players p on p.id = s.player_id
    where s.player_id = any(p_ids) and s.day >= (p.created_at at time zone 'Europe/London')::date
  )
  select d.player_id, sum(d.n)::bigint, (count(*) filter (where d.n > 0))::int, max(d.n)::int,
    (array_agg(d.day order by d.n desc, d.day))[1]
  from d group by d.player_id
$$;
revoke execute on function public.step_totals(uuid[]) from public, anon, authenticated;
