import { Injectable } from '@nestjs/common';
import { AgentType, Intent } from '../../../common/enums';
import { AdminInsightBlock, AgentResponse } from '../../ai/types/agent.types';
import { AiService } from '../../ai/ai.service';
import { AgentRuntimeContext, IAgent } from '../core/agent.interface';

/**
 * Admin-insight agent — answers operator questions about AI usage with a real
 * admin_insight block aggregated from ai_usage_logs (total calls, tokens, latency, usage
 * by agent). Invoked explicitly (agentType=admin_insight) from admin surfaces. The full
 * cross-platform Command Center (students, cohorts, cost) is a later increment (A7/B17);
 * this is the live AI-usage slice of it.
 */
@Injectable()
export class AdminInsightAgentService implements IAgent {
  readonly type = AgentType.AdminInsight;

  constructor(private readonly ai: AiService) {}

  async handle(ctx: AgentRuntimeContext): Promise<AgentResponse> {
    ctx.emit({
      type: 'thinking',
      messageId: '',
      label: 'Aggregating platform AI usage',
    });
    ctx.emit({
      type: 'tool_call',
      messageId: '',
      tool: 'admin.usage',
      label: 'Reading ai_usage_logs',
    });

    const usage = await this.ai.usageSummary();
    ctx.emit({
      type: 'tool_result',
      messageId: '',
      tool: 'admin.usage',
      summary: `${usage.totalCalls} calls across ${usage.byAgent.length} agents`,
    });

    const topAgent = usage.byAgent[0];
    const block: AdminInsightBlock = {
      type: 'admin_insight',
      title: 'AI usage — platform',
      metrics: [
        { label: 'Total AI calls', value: usage.totalCalls },
        {
          label: 'Tokens (est.)',
          value: usage.totalTokens,
          hint: 'in + out, placeholder counts',
        },
        { label: 'Avg latency', value: `${usage.avgLatencyMs}ms` },
        {
          label: 'Top agent',
          value: topAgent ? topAgent.agentType : '—',
          hint: topAgent ? `${topAgent.count} calls` : undefined,
        },
      ],
      notes: usage.byAgent
        .slice(0, 6)
        .map((a) => `${a.agentType}: ${a.count} call(s)`),
    };

    const answer = [
      `**Platform AI usage**`,
      '',
      `- **${usage.totalCalls}** total agent calls`,
      `- **${usage.byAgent.length}** distinct agents in use`,
      `- Avg latency **${usage.avgLatencyMs}ms**`,
      topAgent
        ? `- Busiest agent: **${topAgent.agentType}** (${topAgent.count})`
        : '',
      '',
      `_Full Command Center (students, cohorts, cost, health) lands in a later phase; this is the live AI-usage slice._`,
    ]
      .filter(Boolean)
      .join('\n');
    await this.stream(answer, ctx);
    ctx.emit({ type: 'visual_block', messageId: '', block });

    return {
      agentType: AgentType.AdminInsight,
      intent: Intent.GeneralChat,
      mode: 'mixed',
      answer,
      actions: [],
      visualBlocks: [block],
      confidence: 0.9,
      followUpQuestions: ['Which agent is slowest?', 'How many calls today?'],
      recommendedNextActions: [
        'Open the Admin Command Center for the full picture',
      ],
    };
  }

  private async stream(text: string, ctx: AgentRuntimeContext): Promise<void> {
    for (const token of text.split(/(\s+)/)) {
      ctx.emit({ type: 'chunk', messageId: '', delta: token });
      await new Promise((r) => setTimeout(r, 6));
    }
  }
}
