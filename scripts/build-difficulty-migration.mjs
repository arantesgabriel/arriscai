import { readFileSync, writeFileSync } from "node:fs";
let sql = readFileSync(
  "supabase/migrations/202611170001_lobby_capacity_roulette.sql",
  "utf8",
);
sql = sql.slice(sql.indexOf('create or replace function public.prepare_match('));
sql = sql.replace(
  "), ordered as (",
  `), pool as (
   select jsonb_agg(jsonb_build_object('id',id,'question',question,'answer',answer,'aliases',aliases,'category',category,'difficulty',difficulty)) items from candidates
 ), balanced as (
   select private.balanced_question_deck(coalesce(items,'[]'), planned, selected, selection_mode) items from pool
 ), ordered as (`,
);
const start = sql.indexOf("   select * from candidates order by priority");
const end = sql.indexOf("\n\n if coalesce(jsonb_array_length(deck)", start);
sql =
  sql.slice(0, start) +
  `   select value, ordinality from balanced, jsonb_array_elements(items) with ordinality
 )
 select jsonb_agg(value order by ordinality) into deck from ordered;` +
  sql.slice(end);
writeFileSync(
  "supabase/migrations/202611170003_balanced_decks.sql",
  readFileSync("scripts/difficulty-functions.sql", "utf8") + "\n" + sql,
);
let catalog = readFileSync(
  "supabase/migrations/202611130002_qa_stabilization.sql",
  "utf8",
);
let catStart = catalog.indexOf(
  "create or replace function public.question_catalog(room uuid)",
);
let catEnd = catalog.indexOf("end $$;", catStart) + 7;
writeFileSync(
  "supabase/migrations/202611170003_balanced_decks.sql",
  "\n" +
    catalog
      .slice(catStart, catEnd)
      .replace(
        "'category', category,",
        "'category', category,\n         'difficulty', difficulty,",
      ),
  { flag: "a" },
);
