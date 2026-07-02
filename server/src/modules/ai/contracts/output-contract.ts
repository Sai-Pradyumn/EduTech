/**
 * AI output contract — the JSON schema a caller declares is ENFORCED here, not
 * merely suggested to the model. `validateAgainstSchema` is a dependency-free
 * validator for the schema subset the app uses (type / properties / required /
 * items / enum / min-max bounds). AiService runs it on every live structured
 * response, feeds violations back to the model for one repair pass, and throws
 * AiContractViolationError when the output still doesn't conform — so the call
 * site's deterministic fallback fires and malformed AI output can never reach
 * persistence. Mongoose stops being the first place bad output is discovered.
 */

export interface SchemaViolation {
  /** Dot/bracket path from the root, e.g. `$.weeklyPlan[0].weekNumber`. */
  path: string;
  message: string;
}

/** Enough detail to repair with, without flooding the repair prompt. */
const MAX_VIOLATIONS = 24;

export class AiContractViolationError extends Error {
  constructor(
    public readonly operation: string,
    public readonly violations: SchemaViolation[],
  ) {
    super(
      `AI output for "${operation}" violated its schema after repair: ` +
        violations
          .slice(0, 3)
          .map((v) => `${v.path} — ${v.message}`)
          .join('; ') +
        (violations.length > 3 ? ` (+${violations.length - 3} more)` : ''),
    );
    this.name = 'AiContractViolationError';
  }
}

export function validateAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
): SchemaViolation[] {
  const out: SchemaViolation[] = [];
  walk(value, schema, '$', out);
  return out;
}

/** Bullet list handed back to the model in the repair pass. */
export function formatViolations(violations: SchemaViolation[]): string {
  return violations.map((v) => `- ${v.path}: ${v.message}`).join('\n');
}

function walk(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  out: SchemaViolation[],
): void {
  if (out.length >= MAX_VIOLATIONS) return;

  const type = typeof schema.type === 'string' ? schema.type : undefined;
  if (type && !typeMatches(value, type)) {
    out.push({ path, message: `expected ${type}, got ${describe(value)}` });
    return; // a wrong-typed value has no meaningful children to descend into
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    out.push({
      path,
      message: `must be one of ${schema.enum
        .map((e) => JSON.stringify(e))
        .join(', ')}`,
    });
  }

  if (isPlainObject(value)) {
    const required = Array.isArray(schema.required)
      ? (schema.required as string[])
      : [];
    for (const key of required) {
      const v = value[key];
      // Empty strings fail Mongoose `required: true` too — align with persistence.
      if (
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim() === '')
      ) {
        out.push({
          path: `${path}.${key}`,
          message: 'required property is missing or empty',
        });
      }
    }
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    for (const [key, sub] of Object.entries(props)) {
      const v = value[key];
      if (v !== undefined && v !== null && isPlainObject(sub)) {
        walk(v, sub, `${path}.${key}`, out);
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      out.push({
        path,
        message: `needs at least ${schema.minItems} items, got ${value.length}`,
      });
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      out.push({
        path,
        message: `allows at most ${schema.maxItems} items, got ${value.length}`,
      });
    }
    const items = schema.items;
    if (isPlainObject(items)) {
      for (let i = 0; i < value.length; i++) {
        if (out.length >= MAX_VIOLATIONS) return;
        walk(value[i], items, `${path}[${i}]`, out);
      }
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength)
      out.push({ path, message: `shorter than minLength ${schema.minLength}` });
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength)
      out.push({ path, message: `longer than maxLength ${schema.maxLength}` });
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum)
      out.push({ path, message: `below minimum ${schema.minimum}` });
    if (typeof schema.maximum === 'number' && value > schema.maximum)
      out.push({ path, message: `above maximum ${schema.maximum}` });
  }
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true; // unknown type keyword — stay permissive
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
