import { checkMaintenance } from "./maintenance.ts";

function clientFor(value: unknown, error: unknown = null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: value === null ? null : { value }, error }) };
            },
          };
        },
      };
    },
  };
}

Deno.test("admin bypasses maintenance lookup", async () => {
  const result = await checkMaintenance(clientFor(null), true);
  if (!result.allowed) throw new Error("admin must retain access");
});

Deno.test("enabled maintenance blocks a regular account", async () => {
  const result = await checkMaintenance(clientFor({ enabled: true }), false);
  if (result.allowed || result.code !== "MANTENIMIENTO_ACTIVO") throw new Error("maintenance must block");
});

Deno.test("disabled maintenance allows a regular account", async () => {
  const result = await checkMaintenance(clientFor({ enabled: false }), false);
  if (!result.allowed) throw new Error("disabled maintenance must allow access");
});

Deno.test("missing or unreadable maintenance state fails closed", async () => {
  for (const client of [clientFor(null), clientFor({}, null), clientFor({ enabled: false }, new Error("db"))]) {
    const result = await checkMaintenance(client, false);
    if (result.allowed || result.code !== "MANTENIMIENTO_NO_DISPONIBLE") throw new Error("invalid state must fail closed");
  }
});
