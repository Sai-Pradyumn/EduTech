import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import { AgentResponse, PracticeBlock, VisualBlock } from '../../ai/types/agent.types';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';
import { LlmComposerService } from '../core/llm-composer.service';
import { personaFor } from '../prompts/personas';

/** Detects the kind of problem so the hints are specific, not generic. */
function classify(message: string): { kind: string; causes: string[]; checks: string[] } {
  const m = message.toLowerCase();
  if (/undefined|null|cannot read|is not a function|nan/.test(m)) {
    return {
      kind: 'a null/undefined or type error',
      causes: ['A value is missing/undefined when you use it', 'Async data not loaded yet', 'A typo in a property name'],
      checks: ['Log the variable right before the failing line', 'Check the value exists before accessing its property', 'Confirm async data arrived (await / loading state)'],
    };
  }
  if (/cors|network|fetch|axios|404|500|api|request failed/.test(m)) {
    return {
      kind: 'an API / network error',
      causes: ['Wrong URL or method', 'CORS / auth header missing', 'Server returned an error status'],
      checks: ['Open the Network tab — what status + response body?', 'Verify the URL, method and headers', 'Reproduce the request with curl/Postman'],
    };
  }
  if (/css|style|layout|align|center|flex|grid|not showing|overflow/.test(m)) {
    return {
      kind: 'a CSS / layout issue',
      causes: ['A parent constrains size/overflow', 'Wrong display/position context', 'Specificity overriding your rule'],
      checks: ['Inspect the element — which rule actually applies?', 'Add a temporary outline to see box bounds', 'Check the parent’s display/overflow'],
    };
  }
  if (/build|compile|module not found|cannot find|import|type error|ts\d/.test(m)) {
    return {
      kind: 'a build / import error',
      causes: ['Wrong import path or missing dependency', 'Type mismatch', 'Stale build cache'],
      checks: ['Read the FIRST error (later ones often cascade)', 'Verify the import path & that the package is installed', 'Clear the cache / reinstall and rebuild'],
    };
  }
  return {
    kind: 'a logic bug',
    causes: ['An assumption about the data is wrong', 'Off-by-one / wrong condition', 'State not updating as expected'],
    checks: ['Restate what you expect vs what happens', 'Add logs at each step to find where they diverge', 'Test the smallest input that reproduces it'],
  };
}

/**
 * Doubt-solver agent — hint-first debugging. It never dumps the fix on the first turn:
 * it reflects the problem back, narrows the likely cause, and gives a guided checklist so
 * the student learns to debug. "Show me the fix" escalates to a direct answer.
 */
@Injectable()
export class DoubtSolverAgentService implements IAgent {
  readonly type = AgentType.DoubtSolver;

  constructor(private readonly composer: LlmComposerService) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    const problem = ctx.request.message.trim();
    const reveal =
      ctx.request.context?.['reveal'] === true ||
      /show me the fix|just tell me|reveal the (fix|answer)|give me the (answer|fix)/i.test(problem);
    const c = classify(problem);
    const name = ctx.profile?.fullName?.split(' ')[0];

    ctx.emit({ type: 'thinking', messageId: '', label: 'Reading the error & narrowing the cause' });
    ctx.emit({ type: 'tool_call', messageId: '', tool: 'doubt.classify', label: `Looks like ${c.kind}` });
    ctx.emit({ type: 'tool_result', messageId: '', tool: 'doubt.classify', summary: reveal ? 'Revealing a direct approach' : 'Hint-first (you debug it)' });

    const fallback = reveal ? this.revealAnswer(c, problem) : this.hintAnswer(c, problem, name);
    const system =
      `${personaFor(AgentType.DoubtSolver)}\n` +
      `Detected problem type: ${c.kind}. Likely causes: ${c.causes.join('; ')}. ` +
      (reveal
        ? 'The student asked to SEE THE FIX — give a direct, correct solution and explain why it works.'
        : 'Stay HINT-FIRST: do NOT give the full fix yet; guide them with the most likely cause and one diagnostic question.');
    const answer = await this.composer.streamAnswer(ctx, {
      system,
      fallback,
      agentType: AgentType.DoubtSolver,
      operation: reveal ? 'doubt.reveal' : 'doubt.hint',
      temperature: 0.4,
    });

    const block: PracticeBlock = {
      type: 'practice',
      title: 'Debug checklist',
      prompt: c.checks.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      hint: 'Work top to bottom — stop at the first step where reality differs from your expectation.',
    } satisfies VisualBlock;
    ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.DoubtSolver,
      intent: Intent.DoubtSolving,
      mode: 'mixed',
      answer,
      actions: reveal
        ? [{ id: 'explain', label: 'Explain why this works', kind: 'simpler' }]
        : [
            { id: 'reveal', label: 'Show me the fix', kind: 'custom', payload: { reveal: true } },
            { id: 'explain', label: 'Explain the concept', kind: 'explain_visually' },
          ],
      visualBlocks: [block],
      confidence: 0.85,
      followUpQuestions: ['Here’s what I tried and the new error…', 'Why did that cause the bug?'],
      recommendedNextActions: [
        'Run the checklist and report what you find at each step',
        'Once fixed, write a one-line note on the root cause so it sticks',
      ],
    };
  }

  private hintAnswer(c: { kind: string; causes: string[] }, problem: string, name?: string): string {
    const greet = name ? `${name}, ` : '';
    return [
      `${greet}let's debug this together — I'll guide rather than hand you the answer (that's how it sticks).`,
      '',
      `**What I'm seeing:** this looks like **${c.kind}**.`,
      '',
      `**Most likely causes:**`,
      ...c.causes.map((x) => `- ${x}`),
      '',
      `**Before I say more — answer one thing:** at the failing line, what do you *expect* the value/state to be, and what do you *actually* see when you log it? Work the checklist on the right; reply with what you find and I'll zero in. (Or hit **Show me the fix** if you're stuck.)`,
    ].join('\n');
  }

  private revealAnswer(c: { kind: string; checks: string[] }, problem: string): string {
    return [
      `Okay — here's a direct path for **${c.kind}**:`,
      '',
      ...c.checks.map((s, i) => `${i + 1}. ${s}`),
      '',
      `The fix almost always falls out of step where expectation ≠ reality. Apply it, then re-run. If a *new* error appears, paste it — a new error usually means you fixed the first one.`,
    ].join('\n');
  }
}
