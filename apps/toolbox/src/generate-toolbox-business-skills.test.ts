import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const eveSkillsRoot = join(repositoryRoot, "apps/runtime/agent/skills");

describe("Toolbox business skill authoring", () => {
  it("keeps tools.yaml, the generated skills, and the runtime allowlist on the same tool names", () => {
    const declaredTools = toolNamesFrom(readYaml("apps/toolbox/tools.yaml"));
    const allowlist = toolNamesFrom(readYaml("apps/runtime/agent/connections/toolbox.ts"));
    const referencedTools = readdirSync(eveSkillsRoot).flatMap((skill) => {
      const markdown = readFileSync(join(eveSkillsRoot, skill, "SKILL.md"), "utf8");
      return [...markdown.matchAll(/toolbox__([A-Za-z0-9_-]+)/g)].map((match) => match[1] ?? "");
    });

    expect(declaredTools.sort()).toEqual(allowlist.sort());
    expect(referencedTools.length).toBeGreaterThan(0);
    expect(referencedTools.filter((tool) => !allowlist.includes(tool))).toEqual([]);
  });
});

function readYaml(path: string) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

// Only reads the flat `kind: tool` blocks and the runtime's const allowlist; groups are not tools.
function toolNamesFrom(source: string) {
  if (source.includes("eveToolboxToolNames")) {
    const allowlist = source.slice(
      source.indexOf("eveToolboxToolNames = ["),
      source.indexOf("] as const"),
    );
    return [...allowlist.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  }

  return [...source.matchAll(/^kind: tool\nname: (.+)$/gm)].map((match) => (match[1] ?? "").trim());
}
