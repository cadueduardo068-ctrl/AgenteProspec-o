begin;
update public.cadu_state set data=jsonb_set(data,'{prompts}','[]'::jsonb),version=version+1 where not(data ? 'prompts');
commit;
