import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  compactDescription,
  discoverRoots,
  parseSkillConfigToml,
  parseLiveSkillsPrompt,
  plainLogSkillReads,
  referencedSkillPaths,
  usageEvidence,
} from "./skill-cleaner.ts";

const configFixtures = [
  {
    name: "literal and basic quoted paths plus plugin tables",
    text: String.raw`[[skills.config]]
path = 'C:\Users\MECHREVO\.codex\skills\single'
name = 'single-skill'
enabled = false # inline comments do not change the value

[[skills.config]]
name = "double-skill"
enabled = false
path = "C:\\Users\\MECHREVO\\.codex\\skills\\double"

[[skills.config]]
path = 'C:\Users\MECHREVO\.codex\skills\enabled'
enabled = true

[plugins.'data.plugin@1.0.8']
enabled = false

[plugins."quoted\\plugin"]
enabled = false

[plugins."data.plugin@1.0.8".settings]
enabled = false
`,
    expected: {
      disabledPaths: [
        String.raw`C:\Users\MECHREVO\.codex\skills\single`,
        String.raw`C:\Users\MECHREVO\.codex\skills\double`,
      ],
      disabledNames: ["single-skill", "double-skill"],
      disabledPlugins: ["data.plugin@1.0.8", String.raw`quoted\plugin`],
    },
  },
  {
    name: "tilde paths normalize for Windows matching",
    text: String.raw`[[skills.config]]
path = '~/.codex/skills/tilde'
enabled = false
`,
    expected: {
      disabledPaths: [path.normalize(path.join(os.homedir(), ".codex/skills/tilde"))],
      disabledNames: [],
      disabledPlugins: [],
    },
  },
  {
    name: "ignores table-looking text inside multiline values",
    text: String.raw`[metadata]
description = '''
[[skills.config]]
path = 'C:\fake\inside-multiline'
enabled = false
'''

[[skills.config]]
path = 'C:\real\outside-multiline'
enabled = false
`,
    expected: {
      disabledPaths: [String.raw`C:\real\outside-multiline`],
      disabledNames: [],
      disabledPlugins: [],
    },
  },
  {
    name: "supports multiline values and quoted property keys",
    text: String.raw`[[skills.config]]
"path" = '''
C:\Users\MECHREVO\.codex\skills\multiline-path
'''
"name" = 'multiline-skill'
"enabled" = false
`,
    expected: {
      disabledPaths: [String.raw`C:\Users\MECHREVO\.codex\skills\multiline-path`],
      disabledNames: ["multiline-skill"],
      disabledPlugins: [],
    },
  },
  {
    name: "supports inline skill and plugin config tables",
    text: String.raw`skills = { config = [{ "path" = 'C:\Users\MECHREVO\.codex\skills\inline-path', "name" = "inline-skill", "enabled" = false }, { path = 'C:\Users\MECHREVO\.codex\skills\inline-name', enabled = false }] }
plugins = { "vendor@inline" = { enabled = false }, "vendor@enabled" = { enabled = true } }
`,
    expected: {
      disabledPaths: [
        String.raw`C:\Users\MECHREVO\.codex\skills\inline-path`,
        String.raw`C:\Users\MECHREVO\.codex\skills\inline-name`,
      ],
      disabledNames: ["inline-skill"],
      disabledPlugins: ["vendor@inline"],
    },
  },
] as const;

for (const fixture of configFixtures) {
  test(`parses config fixture: ${fixture.name}`, () => {
    const parsed = parseSkillConfigToml(fixture.text);
    assert.deepEqual([...parsed.disabledPaths].sort(), [...fixture.expected.disabledPaths].sort());
    assert.deepEqual([...parsed.disabledNames].sort(), [...fixture.expected.disabledNames].sort());
    assert.deepEqual([...parsed.disabledPlugins].sort(), [...fixture.expected.disabledPlugins].sort());
  });
}

test("sanitizes malformed TOML diagnostics without echoing config values", () => {
  const secretPath = String.raw`C:\Users\MECHREVO\.codex\skills\private-secret`;
  assert.throws(
    () => parseSkillConfigToml(`[[skills.config]]\npath = "${secretPath}\nenabled = false\n`),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^skill-cleaner: config\.toml parse error at line 2, column \d+$/);
      assert.doesNotMatch(error.message, /private-secret/);
      assert.doesNotMatch(error.message, /C:\\Users/);
      return true;
    },
  );
});

test("does not treat nested plugin tables as plugin enablement", () => {
  const parsed = parseSkillConfigToml(
    String.raw`[plugins."vendor@x".settings]
enabled = false
`,
  );
  assert.deepEqual([...parsed.disabledPlugins], []);
});

test("limits root discovery to explicitly supplied roots", (context) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-cleaner-roots-"));
  context.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const defaultRoots = [
    path.join(temp, ".codex/skills"),
    path.join(temp, ".codex/plugins/cache"),
    path.join(temp, "Projects/agent-scripts/skills"),
    path.join(temp, "Projects/demo/.agents/skills"),
  ];
  const isolatedRoot = path.join(temp, "isolated/skills");
  for (const root of [...defaultRoots, isolatedRoot]) fs.mkdirSync(root, { recursive: true });

  assert.deepEqual(discoverRoots(temp, [isolatedRoot], true), [isolatedRoot]);
  assert.deepEqual(
    discoverRoots(temp, [isolatedRoot], false),
    [...defaultRoots, isolatedRoot].sort(),
  );
});

test("parses Codex skill roots and model-visible lines", () => {
  const raw = JSON.stringify([
    {
      role: "developer",
      content: [{
        type: "input_text",
        text: `<skills_instructions>
## Skills
### Skill roots
- \`r0\` = \`/tmp/skills\`
### Available skills
- demo: Demo work. (file: r0/demo/SKILL.md)
### How to use skills
</skills_instructions>`,
      }],
    },
  ]);

  const parsed = parseLiveSkillsPrompt(raw);
  assert.equal(parsed.roots.get("r0"), "/tmp/skills");
  assert.deepEqual(parsed.skillLines, [
    "- demo: Demo work. (file: r0/demo/SKILL.md)",
  ]);
});

test("compacts prose into a readable trigger phrase", () => {
  const compact = compactDescription(
    "Use this skill when the user wants to inspect calendars, compare availability, review conflicts, and schedule a meeting with timezone-aware details.",
    90,
  );
  assert.equal(
    compact,
    "inspect calendars, compare availability, review conflicts, and schedule a meeting with...",
  );
  assert.ok(compact.length <= 90);
  assert.doesNotMatch(compact, /audit, clean, verify/);
});

test("extracts user evidence without counting developer prompt listings", () => {
  assert.deepEqual(
    usageEvidence({ session_id: "abc", text: "use $skill-cleaner", ts: 123 }),
    { userText: "use $skill-cleaner" },
  );
  assert.deepEqual(
    usageEvidence({
      type: "response_item",
      payload: {
        type: "function_call",
        arguments: "{\"cmd\":\"cat /tmp/skills/demo/SKILL.md\"}",
      },
    }),
    { callArgs: "{\"cmd\":\"cat /tmp/skills/demo/SKILL.md\"}" },
  );
  assert.deepEqual(
    usageEvidence({
      type: "response_item",
      payload: { type: "message", role: "developer", content: ["$skill-cleaner"] },
    }),
    {},
  );
});

test("resolves relative skill reads from function-call workdirs", () => {
  assert.deepEqual(
    referencedSkillPaths(JSON.stringify({
      cmd: "cat skills/demo/SKILL.md",
      workdir: "/tmp/repo",
    })),
    ["/tmp/repo/skills/demo/SKILL.md"],
  );
});

test("counts command-like plain-log reads but ignores rendered listings", () => {
  assert.deepEqual(
    plainLogSkillReads([
      "cat skills/demo/SKILL.md",
      "- other: description (file: /tmp/skills/other/SKILL.md)",
    ].join("\n")),
    ["demo"],
  );
});

test("CLI reports filesystem fallback separately from the unavailable CLI and Desktop inventories", (context) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-cleaner-cli-"));
  context.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const skillDir = path.join(temp, "demo");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: demo\ndescription: Demo skill.\n---\n",
  );

  const cliPath = fileURLToPath(new URL("./skill-cleaner.ts", import.meta.url));
  const raw = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      cliPath,
      "--root-only",
      "--root",
      skillDir,
      "--no-live",
      "--no-logs",
      "--json",
      "--model",
      "gpt-6-astra",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const report = JSON.parse(raw) as {
    budget: { model: string };
    inventorySource: string;
    inventoryDiagnostics: {
      filesystem: { source: string; status: string; skillCount: number };
      cliPrompt: { source: string; status: string; skillCount: number | null };
      desktopCatalog: { source: string; status: string; skillCount: null };
      selectedSource: string;
    };
  };
  assert.equal(report.budget.model, "gpt-6-astra");
  assert.equal(report.inventorySource, "filesystem fallback");
  assert.deepEqual(report.inventoryDiagnostics, {
    filesystem: { source: "filesystem scan", status: "available", skillCount: 1 },
    cliPrompt: { source: "codex debug prompt-input", status: "not-requested", skillCount: null },
    desktopCatalog: { source: "Codex Desktop catalog", status: "not-queried", skillCount: null },
    selectedSource: "filesystem-enabled-fallback",
  });
});
