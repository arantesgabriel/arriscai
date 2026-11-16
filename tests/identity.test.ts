import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
});

describe("identidade anônima", () => {
  it("compartilha a mesma inicialização entre efeito e clique rápido", async () => {
    let finishSignup!: (value: unknown) => void;
    const signup = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSignup = resolve;
        }),
    );
    createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously: signup,
      },
    });
    const { identity } = await import("../src/lib/supabase");
    const fromEffect = identity();
    const fromClick = identity();
    expect(fromClick).toBe(fromEffect);
    await vi.waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
    finishSignup({ data: { user: { id: "same-uid" } }, error: null });
    expect((await fromEffect).id).toBe("same-uid");
    expect((await fromClick).id).toBe("same-uid");
  });

  it("libera nova tentativa após erro de Auth", async () => {
    const signup = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Auth indisponível"),
      })
      .mockResolvedValueOnce({
        data: { user: { id: "recovered" } },
        error: null,
      });
    createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously: signup,
      },
    });
    const { identity } = await import("../src/lib/supabase");
    await expect(identity()).rejects.toThrow("Auth indisponível");
    await expect(identity()).resolves.toMatchObject({ id: "recovered" });
    expect(signup).toHaveBeenCalledTimes(2);
  });

  it("reutiliza a sessão já persistida", async () => {
    const signup = vi.fn();
    createClient.mockReturnValue({
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({
            data: { session: { user: { id: "persisted" } } },
          }),
        signInAnonymously: signup,
      },
    });
    const { identity } = await import("../src/lib/supabase");
    await expect(identity()).resolves.toMatchObject({ id: "persisted" });
    expect(signup).not.toHaveBeenCalled();
  });
});
