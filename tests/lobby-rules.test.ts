import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDatabase } from "../scripts/pg-test-runtime.mjs";
import type { Snapshot } from "../src/lib/game";

describe("preparação automática e expiração", () => {
  it("valida limites no servidor, remove desconectados, transfere organização e exige nova entrada", async () => {
    const db = await testDatabase();
    const [host, player, away, screen, newcomer] = Array.from(
      { length: 5 },
      () => randomUUID(),
    );
    try {
      for (const id of [host, player, away, screen, newcomer])
        await db.query("insert into auth.users values ($1)", [id]);
      await db.exec("update private.settings set allow_provisional=true");
      const rpc = async <T = unknown>(
        id: string,
        name: string,
        args: unknown[] = [],
      ) =>
        db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            id,
          ]);
          await tx.exec("set local role authenticated");
          const { rows } = await tx.query<{ value: T }>(
            `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
            args,
          );
          return rows[0]?.value;
        });
      const room = await rpc<string>(host, "create_room", ["Ana"]);
      const snap = () => rpc<Snapshot>(player, "public_room_snapshot", [room]);
      const { code } = await rpc<Snapshot>(host, "public_room_snapshot", [
        room,
      ]);
      await rpc(player, "join_room", [code, "Bia", false]);
      await rpc(away, "join_room", [code, "Caio", false]);
      await rpc(screen, "join_room", [code, "Telão", true]);
      for (const n of [0, 9, 30])
        await expect(
          rpc(host, "prepare_match", [room, n, ["Esportes"]]),
        ).rejects.toThrow("1 a 8");
      for (const mode of ["manual", "mixed"])
        await expect(
          rpc(host, "prepare_match", [room, 1, ["Esportes"], null, [], mode]),
        ).rejects.toThrow("temporariamente desativada");
      await expect(
        rpc(host, "prepare_match", [
          room,
          1,
          ["Esportes"],
          null,
          ["Q0201"],
          "automatic",
        ]),
      ).rejects.toThrow("temporariamente desativada");
      await expect(
        rpc(host, "prepare_match", [room, 1, ["Esportes"], null, [], null]),
      ).rejects.toThrow("temporariamente desativada");
      for (const n of [1, 8]) {
        await rpc(host, "prepare_match", [room, n, ["Esportes"]]);
        const { game } = await snap();
        if (!game) throw new Error("Partida não preparada");
        expect(game.planned).toBe(n);
        await expect(
          rpc(host, "game_command", [
            room,
            game.id,
            game.version,
            randomUUID(),
            "adjust",
            { rounds: 9 },
          ]),
        ).rejects.toThrow("1 a 8");
        if (n === 8) {
          const {
            rows: [{ questions }],
          } = await db.query<{
            questions: { id: string; difficulty: string }[];
          }>("select questions from private.decks where match_id=$1", [
            game.id,
          ]);
          const played = questions.slice(0, 8);
          expect(
            played.filter(
              (q: { difficulty: string }) => q.difficulty === "dificil",
            ),
          ).toHaveLength(1);
          expect(new Set(questions.map((q: { id: string }) => q.id)).size).toBe(
            13,
          );
          await db.query(
            "update public.room_members set last_seen=now()-interval '3 minutes' where room_id=$1 and user_id=$2",
            [room, away],
          );
          await rpc(player, "heartbeat", [room]);
          expect(
            (await snap()).members.some(
              (m: { user_id: string }) => m.user_id === away,
            ),
          ).toBe(true);
        }
        await rpc(host, "game_command", [
          room,
          game.id,
          game.version,
          randomUUID(),
          "cancel",
          {},
        ]);
      }
      // A consulta de um membro conectado também remove participantes expirados.
      expect(
        (await snap()).members.some(
          (m: { user_id: string }) => m.user_id === away,
        ),
      ).toBe(false);
      await expect(rpc(away, "heartbeat", [room])).rejects.toThrow(
        "Entre novamente pelo link",
      );
      await expect(rpc(away, "public_room_snapshot", [room])).rejects.toThrow(
        "Entre novamente pelo link",
      );
      await rpc(away, "join_room", [code, "Caio", false]);
      expect(
        (await snap()).members.some(
          (m: { user_id: string }) => m.user_id === away,
        ),
      ).toBe(true);
      // Nem o próprio heartbeat tardio pode reativar a inscrição vencida.
      await db.query(
        "update public.room_members set last_seen=now()-interval '2 minutes' where room_id=$1 and user_id=$2",
        [room, away],
      );
      await rpc(away, "heartbeat", [room]);
      await expect(rpc(away, "heartbeat", [room])).rejects.toThrow("expirou");
      // Organizador expirado é substituído por um jogador, nunca pelo telão.
      await db.query(
        "update public.room_members set last_seen=now()-interval '3 minutes' where room_id=$1 and user_id=$2",
        [room, host],
      );
      await rpc(player, "heartbeat", [room]);
      expect((await snap()).host_id).toBe(player);
      await expect(
        rpc(host, "prepare_match", [room, 1, ["Esportes"]]),
      ).rejects.toThrow();
      // Se todos saíram, a primeira nova entrada recupera a organização.
      await db.query(
        "update public.room_members set last_seen=now()-interval '3 minutes' where room_id=$1",
        [room],
      );
      await rpc(newcomer, "join_room", [code, "Dani", false]);
      const rejoined = await rpc<Snapshot>(newcomer, "public_room_snapshot", [
        room,
      ]);
      expect(rejoined.host_id).toBe(newcomer);
      expect(rejoined.members).toHaveLength(1);
      await expect(rpc(player, "heartbeat", [room])).rejects.toThrow("expirou");
      // Entrar por link continua respeitando a capacidade e o contrato público.
      await rpc(host, "join_room", [code, "Ana", false]);
      await rpc(newcomer, "prepare_match", [room, 1, ["Esportes"]]);
    } finally {
      await db.close();
    }
  }, 30000);
});
