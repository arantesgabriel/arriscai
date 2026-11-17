import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase } from "../scripts/pg-test-runtime.mjs";
import { playerColors } from "../src/components/game/player-colors";

describe("regras de vagas e sorteio", () => {
  it("oferece 14 cores diferentes", () =>
    expect(new Set(playerColors).size).toBe(14));
  it("limita participantes, permite telão e preserva o evento compartilhado", async () => {
    const db = await testDatabase();
    try {
      const ids = Array.from({ length: 16 }, () => randomUUID());
      for (const id of ids)
        await db.query("insert into auth.users values ($1)", [id]);
      const room = randomUUID();
      await db.query(
        "insert into public.rooms(id,code,host_id) values ($1,'SLOTS014',$2)",
        [room, ids[0]],
      );
      for (const [index, id] of ids.slice(0, 14).entries())
        await db.query(
          "insert into public.room_members(room_id,user_id,nickname) values ($1,$2,$3)",
          [room, id, `Pessoa ${index}`],
        );
      const rpc = (id: string, sql: string, args: unknown[] = []) =>
        db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            id,
          ]);
          await tx.exec("set local role authenticated");
          return tx.query(sql, args);
        });
      await expect(
        rpc(ids[14], "select public.join_room('SLOTS014','Lotado',false)"),
      ).rejects.toThrow("14 participantes");
      await rpc(ids[15], "select public.join_room('SLOTS014','Tela',true)");
      await rpc(ids[1], "select public.join_room('SLOTS014','Pessoa 1',false)");
      await rpc(ids[0], "select public.choose_host($1)", [room]);
      const { rows } = await db.query<{
        host_id: string;
        roulette: { previous_host_id: string; members: unknown[] };
      }>("select host_id,roulette from public.rooms where id=$1", [room]);
      expect(rows[0].roulette.previous_host_id).toBe(ids[0]);
      expect(rows[0].roulette.members).toHaveLength(14);
      await expect(
        rpc(rows[0].host_id, "select public.choose_host($1)", [room]),
      ).rejects.toThrow("Aguarde o sorteio terminar");
      await expect(
        rpc(
          rows[0].host_id,
          "select public.prepare_match($1,1,array['Música'])",
          [room],
        ),
      ).rejects.toThrow("Aguarde o sorteio terminar");
      await db.query(
        "update public.rooms set roulette=jsonb_set(roulette,'{spun_at}',to_jsonb(now()-interval '6 seconds')) where id=$1",
        [room],
      );
      await rpc(rows[0].host_id, "select public.choose_host($1,$2)", [
        room,
        ids[0],
      ]);
      await db.query(
        "insert into public.room_members(room_id,user_id,nickname) values ($1,$2,'Legado')",
        [room, ids[14]],
      );
      await expect(
        rpc(ids[0], "select public.prepare_match($1,1,array['Música'])", [
          room,
        ]),
      ).rejects.toThrow("no máximo 14 participantes");
    } finally {
      await db.close();
    }
  }, 30000);
});
