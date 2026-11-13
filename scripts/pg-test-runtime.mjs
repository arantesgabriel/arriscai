// Test-only PostgreSQL runtime. Not imported by the application.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
export async function testDatabase({ afterMigration } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
create schema realtime; create table realtime.messages(extension text); alter table realtime.messages enable row level security;
create table realtime.sent(payload jsonb,event text,topic text,private boolean);
create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into realtime.sent values(payload,event,topic,private)$$;
create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
grant usage on schema realtime to authenticated; grant select,insert on realtime.messages to authenticated;
grant execute on function realtime.topic() to authenticated;
`);
  const migrations = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await afterMigration?.(file, db);
  }
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));

  return db;
}
