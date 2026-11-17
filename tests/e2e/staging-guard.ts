import { expect } from "@playwright/test";

export async function assertStagingFrontend() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const stagingRef = process.env.ARRISCAI_STAGING_PROJECT_REF?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const ref = configuredUrl
    ? new URL(configuredUrl).hostname.split(".")[0]
    : "";
  if (
    !configuredUrl?.startsWith("https://") ||
    !key ||
    !stagingRef ||
    ref !== stagingRef
  )
    throw new Error(
      "Hosted E2E requires a matching staging URL, ref and publishable key.",
    );

  // Navigating to the app signs in anonymously. Inspect its served bundle first.
  const origin = `http://127.0.0.1:${process.env.ARRISCAI_E2E_PORT ?? "3000"}`;
  const html = await (await fetch(`${origin}/jogar`)).text();
  // Inspect the actual entry route and all its chunks: extracting visual
  // components can move the Supabase module out of app/page.js.
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)];
  const chunks = await Promise.all(
    scripts.map(async ([, path]) =>
      (await fetch(new URL(path, origin))).text(),
    ),
  );
  const servedRefs = [
    ...new Set(
      chunks.flatMap((chunk) =>
        [
          ...chunk.matchAll(
            /createClient\)[\s\S]{0,10}https:\/\/([a-z0-9]+)\.supabase\.co/g,
          ),
        ].map((m) => m[1]),
      ),
    ),
  ];
  expect(servedRefs).toEqual([stagingRef]);
}
