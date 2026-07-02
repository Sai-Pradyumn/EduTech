import { Logger } from '@nestjs/common';
import { AiService } from '../ai.service';
import {
  AiContractViolationError,
  validateAgainstSchema,
} from './output-contract';

/**
 * The AI output contract: declared schemas are enforced, violations are repaired
 * once with the model, and unrepairable output becomes a typed error so call-site
 * fallbacks fire. Bad AI output can never flow onward into persistence.
 */

const ROADMAP_LIKE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['title', 'weeklyPlan', 'milestones'],
  properties: {
    title: { type: 'string' },
    weeklyPlan: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['weekNumber', 'title', 'focus'],
        properties: {
          weekNumber: { type: 'integer' },
          title: { type: 'string' },
          focus: { type: 'string' },
        },
      },
    },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'targetWeek'],
        properties: {
          title: { type: 'string' },
          targetWeek: { type: 'integer' },
        },
      },
    },
    level: { type: 'string', enum: ['beginner', 'advanced'] },
  },
};

/** The exact production failure: object arrays returned as bare strings. */
const BAD_OUTPUT = {
  title: 'Java Roadmap',
  weeklyPlan: [{ topic: 'Java basics' }], // missing weekNumber/title/focus
  milestones: ['Complete Java basics course'], // string, not object
};

const GOOD_OUTPUT = {
  title: 'Java Roadmap',
  weeklyPlan: [{ weekNumber: 1, title: 'Week 1', focus: 'Java basics' }],
  milestones: [{ title: 'Basics done', targetWeek: 1 }],
};

describe('validateAgainstSchema', () => {
  it('accepts conforming output', () => {
    expect(validateAgainstSchema(GOOD_OUTPUT, ROADMAP_LIKE_SCHEMA)).toEqual([]);
  });

  it('reports bare strings where the schema requires objects, with paths', () => {
    const violations = validateAgainstSchema(BAD_OUTPUT, ROADMAP_LIKE_SCHEMA);
    const paths = violations.map((v) => v.path);
    expect(paths).toContain('$.milestones[0]');
    expect(paths).toContain('$.weeklyPlan[0].weekNumber');
    expect(paths).toContain('$.weeklyPlan[0].focus');
  });

  it('treats empty strings as violating required (matches Mongoose)', () => {
    const violations = validateAgainstSchema(
      { ...GOOD_OUTPUT, title: '   ' },
      ROADMAP_LIKE_SCHEMA,
    );
    expect(violations.some((v) => v.path === '$.title')).toBe(true);
  });

  it('enforces enum, minItems and integer types', () => {
    const violations = validateAgainstSchema(
      {
        ...GOOD_OUTPUT,
        level: 'expert',
        weeklyPlan: [],
      },
      ROADMAP_LIKE_SCHEMA,
    );
    expect(violations.some((v) => v.path === '$.level')).toBe(true);
    expect(
      violations.some(
        (v) => v.path === '$.weeklyPlan' && v.message.includes('at least 1'),
      ),
    ).toBe(true);
    const nonInt = validateAgainstSchema(
      {
        ...GOOD_OUTPUT,
        weeklyPlan: [{ weekNumber: 1.5, title: 'W', focus: 'f' }],
      },
      ROADMAP_LIKE_SCHEMA,
    );
    expect(nonInt.some((v) => v.path === '$.weeklyPlan[0].weekNumber')).toBe(
      true,
    );
  });

  it('non-object roots and unknown keywords stay safe', () => {
    expect(
      validateAgainstSchema('just a string', ROADMAP_LIKE_SCHEMA).length,
    ).toBeGreaterThan(0);
    expect(validateAgainstSchema({ a: 1 }, { type: 'object' })).toEqual([]);
  });
});

// ───────────────────── pipeline behaviour inside AiService ─────────────────────

function service(over: Partial<Record<string, unknown>> = {}) {
  const provider = {
    name: 'fake',
    isLive: over.isLive ?? true,
    generateStructuredOutput: jest.fn(),
  };
  const gateway = { strategy: 'fallback' };
  const usageModel = { create: jest.fn().mockResolvedValue({}) };
  const entitlements = {
    enforceAiBudget: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const ai = new AiService(
    provider as never,
    gateway as never,
    usageModel as never,
    entitlements as never,
  );
  return { ai, provider };
}

describe('AiService structured-output contract pipeline', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  const MESSAGES = [{ role: 'user' as const, content: 'plan my learning' }];

  it('conforming live output passes straight through (no extra calls)', async () => {
    const { ai, provider } = service();
    provider.generateStructuredOutput.mockResolvedValue(GOOD_OUTPUT);
    const out = await ai.generateStructuredOutput(
      MESSAGES,
      ROADMAP_LIKE_SCHEMA,
    );
    expect(out).toEqual(GOOD_OUTPUT);
    expect(provider.generateStructuredOutput).toHaveBeenCalledTimes(1);
  });

  it('violating output triggers ONE repair pass carrying the exact violations', async () => {
    const { ai, provider } = service();
    provider.generateStructuredOutput
      .mockResolvedValueOnce(BAD_OUTPUT)
      .mockResolvedValueOnce(GOOD_OUTPUT);
    const out = await ai.generateStructuredOutput(
      MESSAGES,
      ROADMAP_LIKE_SCHEMA,
      { meta: { operation: 'roadmap.generate' } },
    );
    expect(out).toEqual(GOOD_OUTPUT);
    expect(provider.generateStructuredOutput).toHaveBeenCalledTimes(2);

    const calls = provider.generateStructuredOutput.mock.calls as [
      { role: string; content: string }[],
    ][];
    const repairMessages = calls[1][0];
    // The model sees its own bad JSON and the precise problems to fix.
    expect(
      repairMessages.some(
        (m) =>
          m.role === 'assistant' &&
          m.content.includes('Complete Java basics course'),
      ),
    ).toBe(true);
    const repairAsk = repairMessages[repairMessages.length - 1];
    expect(repairAsk.content).toContain('$.milestones[0]');
    expect(repairAsk.content).toContain('$.weeklyPlan[0].weekNumber');
  });

  it('unrepairable output throws a typed violation so fallbacks fire', async () => {
    const { ai, provider } = service();
    provider.generateStructuredOutput.mockResolvedValue(BAD_OUTPUT);
    await expect(
      ai.generateStructuredOutput(MESSAGES, ROADMAP_LIKE_SCHEMA, {
        meta: { operation: 'roadmap.generate' },
      }),
    ).rejects.toThrow(AiContractViolationError);
    expect(provider.generateStructuredOutput).toHaveBeenCalledTimes(2);
  });

  it('offline (mock provider) output is exempt — mockFactory shapes are caller-owned', async () => {
    const { ai, provider } = service({ isLive: false });
    provider.generateStructuredOutput.mockResolvedValue({ modules: [] });
    const out = await ai.generateStructuredOutput(
      MESSAGES,
      ROADMAP_LIKE_SCHEMA,
    );
    expect(out).toEqual({ modules: [] });
    expect(provider.generateStructuredOutput).toHaveBeenCalledTimes(1);
  });
});
