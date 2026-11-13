// Test transport only: real SQL/RLS, simulated Supabase Auth and Phoenix wire protocol.
// This cannot certify hosted Supabase Auth, Realtime or production network behavior.
import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { testDatabase } from "../../scripts/pg-test-runtime.mjs";
export async function harness() {
  const db = await testDatabase();
  await db.exec("update private.settings set allow_provisional=true");
  const users = new Map<string, Record<string, unknown>>();
  const sockets = new Map<
    WebSocketRoute,
    { topic: string; join: string; uid: string }
  >();
  const encode = (x: unknown) =>
    Buffer.from(JSON.stringify(x)).toString("base64url");
  const token = (id: string) =>
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
      is_anonymous: true,
    }) +
    ".test";
  const uid = (t: string) => {
    try {
      return JSON.parse(
        Buffer.from(
          t.replace("Bearer ", "").split(".")[1],
          "base64url",
        ).toString(),
      ).sub as string;
    } catch {
      return "";
    }
  };
  const execute = async (
    id: string,
    name: string,
    args: Record<string, unknown>,
  ) =>
    db.transaction(async (tx) => {
      await tx.query(
        `select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`,
        [id, JSON.stringify({ sub: id, is_anonymous: true })],
      );
      await tx.exec("set local role authenticated");
      if (
        !/^[a-z_]+$/.test(name) ||
        !Object.keys(args).every((x) => /^[a-z_]+$/.test(x))
      )
        throw new Error("invalid RPC");
      const keys = Object.keys(args);
      const result = await tx.query<{ value: unknown }>(
        `select public.${name}(${keys.map((k, i) => k + " => $" + (i + 1)).join(",")}) as value`,
        Object.values(args),
      );
      return result.rows[0]?.value;
    });
  async function handleRequest(route: Route) {
      const request = route.request(),
        url = new URL(request.url());
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "content-type": "application/json",
      };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 200, headers, body: "" });
        return;
      }
      try {
        let data: unknown;
        if (url.pathname === "/auth/v1/signup") {
          const id = randomUUID();
          const user = {
            id,
            aud: "authenticated",
            role: "authenticated",
            email: "",
            is_anonymous: true,
            app_metadata: { provider: "anonymous", providers: ["anonymous"] },
            user_metadata: {},
            created_at: new Date().toISOString(),
          };
          users.set(id, user);
          await db.transaction(async (tx) => {
            await tx.exec("reset role");
            await tx.query("insert into auth.users values($1)", [id]);
          });
          data = {
            access_token: token(id),
            refresh_token: randomUUID(),
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user,
          };
        } else if (url.pathname === "/auth/v1/user")
          data = users.get(uid(request.headers().authorization ?? ""));
        else if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const id = uid(request.headers().authorization ?? "");
          if (!users.has(id)) throw new Error("Missing user");
          data = await execute(
            id,
            url.pathname.split("/").pop()!,
            request.postDataJSON(),
          );
          if (
            ![
              "public_room_snapshot",
              "host_private_round_snapshot",
              "question_catalog",
              "heartbeat",
            ].some((x) => url.pathname.endsWith(x))
          ) {
            for (const [ws, sub] of sockets)
              ws.send(
                JSON.stringify([
                  sub.join,
                  null,
                  sub.topic,
                  "broadcast",
                  { event: "state_changed", type: "broadcast", payload: {} },
                ]),
              );
          }
        } else throw new Error("Unsupported test endpoint " + url.pathname);
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify(data ?? null),
        });
      } catch (e) {
        await route.fulfill({
          status: 400,
          headers,
          body: JSON.stringify({
            message: (e as Error).message,
            code: "TEST_RPC",
          }),
        });
      }
  }

  function handleSocket(ws: WebSocketRoute) {
      ws.onMessage(async (raw) => {
        const msg = JSON.parse(String(raw));
        const [join, ref, topic, event, payload] = msg;
        const reply = (status = "ok", response = {}) =>
          ws.send(
            JSON.stringify([
              join,
              ref,
              topic,
              "phx_reply",
              { status, response },
            ]),
          );
        if (event === "phx_join") {
          const id = uid(payload.access_token ?? "");
          const room = topic.replace(/^realtime:room:/, "");
          try {
            await execute(id, "public_room_snapshot", { room });
            sockets.set(ws, { topic, join, uid: id });
            reply();
            ws.send(JSON.stringify([join, null, topic, "presence_state", {}]));
          } catch {
            reply("error", { reason: "forbidden" });
          }
        } else if (event === "heartbeat") reply();
        else if (event === "presence") {
          const sub = sockets.get(ws);
          if (!sub) return;
          reply();
          const state = Object.fromEntries(
            [...sockets.values()]
              .filter((s) => s.topic === topic)
              .map((s) => [
                s.uid,
                { metas: [{ phx_ref: s.uid, user_id: s.uid }] },
              ]),
          );
          for (const [other, s] of sockets)
            if (s.topic === topic)
              other.send(
                JSON.stringify([s.join, null, topic, "presence_state", state]),
              );
        } else if (event === "phx_leave") {
          sockets.delete(ws);
          reply();
        } else reply();
      });
      ws.onClose(() => sockets.delete(ws));
  }

  async function attach(context: BrowserContext) {
    await context.route("http://127.0.0.1:54321/**", handleRequest);
    // A reused developer server may have a hosted Supabase URL baked into its
    // client bundle. Local E2E must still be unable to mutate that project.
    await context.route(
      /^https?:\/\/[a-z0-9-]+\.supabase\.co\/.*$/i,
      handleRequest,
    );
    await context.routeWebSocket("ws://127.0.0.1:54321/**", handleSocket);
    await context.routeWebSocket(
      /^wss:\/\/[a-z0-9-]+\.supabase\.co\/.*$/i,
      handleSocket,
    );
  }
  return { attach, close: () => db.close() };
}
