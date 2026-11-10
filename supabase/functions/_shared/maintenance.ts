type MaintenanceRow = { value?: unknown };
type MaintenanceClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: MaintenanceRow | null; error: unknown }>;
      };
    };
  };
};

export type MaintenanceDecision = {
  allowed: boolean;
  code?: "MANTENIMIENTO_ACTIVO" | "MANTENIMIENTO_NO_DISPONIBLE";
  message?: string;
};

/** Read the shared switch once for each server request. Admins keep access. */
export async function checkMaintenance(
  source: unknown,
  isAdmin: boolean,
): Promise<MaintenanceDecision> {
  if (isAdmin) return { allowed: true };

  try {
    const client = source as MaintenanceClient;
    const { data, error } = await client
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance")
      .maybeSingle();

    if (error || !data || !data.value || typeof data.value !== "object") {
      return unavailable();
    }

    const enabled = (data.value as Record<string, unknown>).enabled;
    if (typeof enabled !== "boolean") return unavailable();
    if (enabled) {
      return {
        allowed: false,
        code: "MANTENIMIENTO_ACTIVO",
        message: "La plataforma está en mantenimiento. No se ejecutó la consulta.",
      };
    }
    return { allowed: true };
  } catch {
    return unavailable();
  }
}

function unavailable(): MaintenanceDecision {
  return {
    allowed: false,
    code: "MANTENIMIENTO_NO_DISPONIBLE",
    message: "No se pudo confirmar la disponibilidad de la plataforma. Intenta de nuevo.",
  };
}
