-- Pool de premios pre-definidos para o Sorteio ao Vivo (raffle_events), no
-- mesmo espirito do fixed_prize_pool dos links de indicacao: o operador
-- monta um plano (tipo + quantidade de cada premio), o sistema expande e
-- embaralha numa fila, e cada ganhador sorteado consome um item da fila de
-- forma atomica (lock de linha), sem risco de dois ganhadores pegarem o
-- mesmo premio numa corrida.

alter table public.raffle_events
  add column if not exists prize_pool_plan jsonb not null default '[]'::jsonb,
  add column if not exists prize_pool jsonb not null default '[]'::jsonb;

create or replace function public.build_raffle_prize_pool(p_plan jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_item jsonb;
  v_count int;
  v_out jsonb := '[]'::jsonb;
  v_unit jsonb;
  i int;
  j int;
  v_tmp jsonb;
  v_len int;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_plan, '[]'::jsonb))
  loop
    v_count := greatest(0, coalesce((v_item->>'count')::int, 0));
    v_unit := jsonb_build_object(
      'type', v_item->>'type',
      'amount', coalesce((v_item->>'amount')::numeric, 0),
      'caseId', v_item->>'caseId',
      'caseName', v_item->>'caseName',
      'label', v_item->>'label'
    );
    for i in 1..v_count loop
      v_out := v_out || jsonb_build_array(v_unit);
    end loop;
  end loop;

  -- Fisher-Yates shuffle
  v_len := jsonb_array_length(v_out);
  for i in reverse (v_len - 1)..1 loop
    j := floor(random() * (i + 1));
    v_tmp := v_out->i;
    v_out := jsonb_set(v_out, array[i::text], v_out->j);
    v_out := jsonb_set(v_out, array[j::text], v_tmp);
  end loop;

  return v_out;
end;
$$;

create or replace function public.refresh_raffle_prize_pool()
returns trigger
language plpgsql
as $$
begin
  if new.prize_pool_plan is distinct from old.prize_pool_plan then
    new.prize_pool := public.build_raffle_prize_pool(new.prize_pool_plan);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_raffle_prize_pool on public.raffle_events;
create trigger trg_refresh_raffle_prize_pool
  before update on public.raffle_events
  for each row
  execute function public.refresh_raffle_prize_pool();

-- Consome ate p_count itens do topo da fila de forma atomica (lock de linha).
-- Retorna os itens retirados (pode ser menos que p_count se a fila acabou).
create or replace function public.pop_raffle_prize_pool(p_event_id uuid, p_count int)
returns jsonb
language plpgsql
as $$
declare
  v_pool jsonb;
  v_take int;
  v_taken jsonb;
  v_rest jsonb;
begin
  select prize_pool into v_pool from public.raffle_events where id = p_event_id for update;
  if v_pool is null then
    v_pool := '[]'::jsonb;
  end if;

  v_take := least(greatest(0, p_count), jsonb_array_length(v_pool));
  if v_take = 0 then
    return '[]'::jsonb;
  end if;

  v_taken := (select jsonb_agg(elem) from jsonb_array_elements(v_pool) with ordinality as t(elem, idx) where idx <= v_take);
  v_rest := (select coalesce(jsonb_agg(elem), '[]'::jsonb) from jsonb_array_elements(v_pool) with ordinality as t(elem, idx) where idx > v_take);

  update public.raffle_events set prize_pool = v_rest where id = p_event_id;

  return v_taken;
end;
$$;
