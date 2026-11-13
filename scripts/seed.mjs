import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (!process.env.SUPABASE_DB_URL)
  throw new Error("Defina SUPABASE_DB_URL para o projeto autorizado.");
const result = spawnSync(
  "psql",
  [process.env.SUPABASE_DB_URL, "-v", "ON_ERROR_STOP=1"],
  {
    input: readFileSync("supabase/seed.sql"),
    stdio: ["pipe", "inherit", "inherit"],
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
