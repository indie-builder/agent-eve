import { HealthStatusSchema, type HealthStatus } from "@agent-template/shared";

export type HealthResult =
  | {
      ok: true;
      data: HealthStatus;
    }
  | {
      ok: false;
      error: string;
    };

export async function fetchHealth(): Promise<HealthResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:14000";

  try {
    const response = await fetch(`${baseUrl}/health`, {
      next: { revalidate: 5 },
    });

    if (!response.ok) {
      return { ok: false, error: `API returned ${response.status}` };
    }

    return { ok: true, data: HealthStatusSchema.parse(await response.json()) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to load health status",
    };
  }
}
