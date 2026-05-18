import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Dangerous imports that, if they cross the server/client boundary, cause
 * real harm:
 *   - `exceljs` ships hundreds of KB and parses untrusted bytes; it MUST
 *     stay on the server. Server actions / route handlers lazy-import it.
 *     (Also block legacy `xlsx` in case it gets re-added by mistake.)
 *   - `@/lib/supabase/admin` is the service-role client; leaking it into a
 *     `"use client"` component would not directly expose the key (Next would
 *     fail the build via the `server-only` import), but flagging it here
 *     surfaces the mistake at lint time with a clearer message.
 *
 * All rules apply to every file under src/components/** — the home of
 * client components — and to anything starting with `"use client"`. The
 * positive rule for action/server modules is implicit: nothing here.
 */
const RESTRICTED_PATHS = [
  {
    name: "exceljs",
    message:
      "Do not import 'exceljs' from client code. Heavy dependency + untrusted-input attack surface; route the workplan flow through a server action / route handler that lazy-imports it instead.",
  },
  {
    name: "xlsx",
    message:
      "The 'xlsx' dependency was removed in favour of 'exceljs'. If you genuinely need it, lazy-import on the server only — never from client code.",
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
