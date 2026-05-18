import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Dangerous imports that, if they cross the server/client boundary, cause
 * real harm:
 *   - `xlsx` ships ~600 KB and has a long history of CVEs; client bundle
 *     bloat + parsing untrusted bytes in the browser would be a regression
 *     waiting to happen. Server actions (`"use server"`) load it lazily.
 *   - `@/lib/supabase/admin` is the service-role client; leaking it into a
 *     `"use client"` component would not directly expose the key (Next would
 *     fail the build via the `server-only` import), but flagging it here
 *     surfaces the mistake at lint time with a clearer message.
 *
 * Both rules are applied to every file under src/components/** — the home
 * of client components — and to anything starting with `"use client"`. The
 * positive rule for action/server modules is implicit: nothing here.
 */
const RESTRICTED_PATHS = [
  {
    name: "xlsx",
    message:
      "Do not import 'xlsx' from client code. Heavy dependency + untrusted-input attack surface; route the workplan-import flow through a server action that lazy-imports it instead.",
  },
  {
    name: "@/lib/supabase/admin",
    message:
      "The admin (service-role) Supabase client must never be imported into client code. Use the user-scoped server client (`@/lib/supabase/server`) or a server action that owns the privileged operation.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "**/.next/**",
    ".claude/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: RESTRICTED_PATHS,
        },
      ],
    },
  },
]);

export default eslintConfig;
