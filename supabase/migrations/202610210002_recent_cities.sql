begin;
update public.cadu_state set data=jsonb_set(data,'{recentCities}','[]'::jsonb),version=version+1 where not(data ? 'recentCities');
commit;
