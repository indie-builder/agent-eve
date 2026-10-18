export const defaultDatabaseUrl =
  "postgresql://project_template:project_template@localhost:15432/project_template?schema=public";

export function getDatabaseUrl(input: Record<string, string | undefined> = process.env): string {
  return input.DATABASE_URL ?? defaultDatabaseUrl;
}
