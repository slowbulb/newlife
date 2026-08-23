import "server-only";
import { z } from "zod";
import { EDGE_TYPES, NODE_TYPE_KEYS, PASS1_LABEL_MEANING } from "./taxonomy";
import { PASS1_LABELS } from "./types";
import type { ClassificationPass1, ClassificationPass2 } from "./types";

const TERMINAL_FORMS = ["action", "repetition", "decision", "understanding", "waiting", null] as const;

const PASS1_SCHEMA = {
  type: "object" as const,
  properties: {
    label: {
      type: "string" as const,
      enum: PASS1_LABELS as unknown as string[],
      description: Object.entries(PASS1_LABEL_MEANING)
        .map(([k, v]) => `"${k}": ${v}`)
        .join("; "),
    },
  },
  required: ["label"],
};

const PASS2_SCHEMA = {
  type: "object" as const,
  properties: {
    node: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: NODE_TYPE_KEYS, description: "Specific taxonomy type — pick the single best fit." },
        title: { type: "string", description: "Short, clean title distilled from the raw capture (keep his own wording where possible)." },
        terminal_form: { type: ["string", "null"], enum: TERMINAL_FORMS },
        domain: { type: ["string", "null"], description: "Life domain / lane, e.g. music, health, work, home. Null if unclear — do not force one." },
        lane: { type: ["string", "null"], description: "Usually mirror domain; only differs for a finer sub-lane." },
        owner: { type: ["string", "null"], description: "Who owns resolving this if it's a decision — a name, 'me', or null. Empty/'us' is a red state, so use 'us' rather than guessing a single owner for a joint decision." },
        external_holder: { type: ["string", "null"], description: "The other person holding part of this commitment, if any. A date with nobody on the other end isn't a real deadline — leave null rather than inventing one." },
        due_date: { type: ["string", "null"], description: "ISO YYYY-MM-DD if a date is stated or clearly implied, else null." },
      },
      required: ["type", "title", "terminal_form", "domain", "lane", "owner", "external_holder", "due_date"],
    },
    additional_nodes: {
      type: "array",
      description: "Extra nodes if this capture is really more than one thing — most thoughts are several things at once. Empty array if it's genuinely just the one node.",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: NODE_TYPE_KEYS },
          title: { type: "string" },
          terminal_form: { type: ["string", "null"], enum: TERMINAL_FORMS },
          relation: { type: "string", enum: EDGE_TYPES, description: "How this additional node relates to the primary node above (edge direction: primary -> this)." },
        },
        required: ["type", "title", "terminal_form", "relation"],
      },
    },
    suggested_edges: {
      type: "array",
      description: "Edges from the primary node to EXISTING nodes, only when the candidate list below makes one obviously true. Empty array if nothing is a confident match — do not guess.",
      items: {
        type: "object",
        properties: {
          to_title: { type: "string", description: "Must exactly match one title from the candidate list provided." },
          type: { type: "string", enum: EDGE_TYPES },
        },
        required: ["to_title", "type"],
      },
    },
  },
  required: ["node", "additional_nodes", "suggested_edges"],
};

const pass1ResultSchema = z.object({ label: z.enum(PASS1_LABELS) });

const pass2NodeSchema = z.object({
  type: z.enum(NODE_TYPE_KEYS),
  title: z.string(),
  terminal_form: z.enum(["action", "repetition", "decision", "understanding", "waiting"]).nullable(),
  domain: z.string().nullable(),
  lane: z.string().nullable(),
  owner: z.string().nullable(),
  external_holder: z.string().nullable(),
  due_date: z.string().nullable(),
});

const pass2ResultSchema = z.object({
  node: pass2NodeSchema,
  additional_nodes: z.array(
    z.object({
      type: z.enum(NODE_TYPE_KEYS),
      title: z.string(),
      terminal_form: z.enum(["action", "repetition", "decision", "understanding", "waiting"]).nullable(),
      relation: z.enum(EDGE_TYPES as [string, ...string[]]),
    }),
  ),
  suggested_edges: z.array(
    z.object({
      to_title: z.string(),
      type: z.enum(EDGE_TYPES as [string, ...string[]]),
    }),
  ),
});

const PASS1_SYSTEM = `You triage a raw thought captured into a personal life-mapping app. Sort it into exactly one of six
buckets. Six options, not twenty — past ~7 mutually-exclusive labels accuracy drops, so do not invent new labels.
"unsorted" is a legitimate, permanent resting state when nothing else confidently fits — never force a guess.`;

const PASS2_SYSTEM = `You enrich a raw capture from a personal life-mapping app into a graph node. His vocabulary matters:
he calls parked material "sidelined", never "someday/maybe". Not everything is a to-do — resist forcing action-shaped
answers onto things that are really a decision, an unresolved understanding, a spark (a non-actionable idea worth
keeping), or a constraint. A skill has no done-state; it decomposes into a practice ladder plus a repetition, never a
checklist, so do not classify a skill itself as terminal_form "action". Most thoughts are more than one thing at once
— use additional_nodes freely rather than cramming everything into one title. Only propose suggested_edges when a
candidate from the provided list is an obvious, confident match — an empty array is the right answer far more often
than a guess.`;

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}
interface AnthropicMessageResponse {
  content: Array<AnthropicToolUseBlock | { type: string; [k: string]: unknown }>;
}

async function callTool(system: string, userContent: string, toolName: string, schema: object): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      tools: [{ name: toolName, description: `Records the ${toolName} result.`, input_schema: schema }],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as AnthropicMessageResponse;
  const toolUse = data.content.find(
    (b): b is AnthropicToolUseBlock => b.type === "tool_use" && (b as AnthropicToolUseBlock).name === toolName,
  );
  if (!toolUse) throw new Error(`Model did not call ${toolName}`);
  return toolUse.input;
}

export async function classifyPass1(rawText: string): Promise<ClassificationPass1> {
  const input = await callTool(PASS1_SYSTEM, rawText, "classify_pass1", PASS1_SCHEMA);
  return pass1ResultSchema.parse(input);
}

export async function classifyPass2(
  rawText: string,
  pass1Label: string,
  candidateTitles: string[],
): Promise<ClassificationPass2> {
  const user =
    `Raw capture: """${rawText}"""\n\n` +
    `Pass-1 bucket (already decided, do not relitigate): ${pass1Label}\n\n` +
    (candidateTitles.length
      ? `Existing node titles you may reference for suggested_edges (use exact strings only):\n${candidateTitles
          .slice(0, 60)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : `No existing nodes yet — suggested_edges must be an empty array.`);
  const input = await callTool(PASS2_SYSTEM, user, "classify_pass2", PASS2_SCHEMA);
  return pass2ResultSchema.parse(input) as ClassificationPass2;
}
