import { Injectable, Logger } from '@nestjs/common';

export type AgentTool = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolDescriptor {
  name: string;
  description: string;
  /** Read-only tools are safe for an LLM to invoke without an approval gate. */
  readOnly: boolean;
  /** Whitelisted arg keys an LLM is allowed to provide (others are dropped). */
  argKeys: string[];
  run: AgentTool;
}

/**
 * Central registry of callable agent tools. Feature modules register tools at init
 * (wrapping their services). `safeCall` is the static critic: only registered tools run,
 * only whitelisted arg keys pass through, LLM-supplied args can never override the
 * server-trusted ones (e.g. userId), and non-read-only tools require explicit allowance.
 */
@Injectable()
export class AgentToolRegistryService {
  private readonly logger = new Logger(AgentToolRegistryService.name);
  private readonly tools = new Map<string, ToolDescriptor>();

  register(descriptor: ToolDescriptor): void {
    this.tools.set(descriptor.name, descriptor);
  }

  list(): { name: string; description: string; readOnly: boolean }[] {
    return [...this.tools.values()].map(({ name, description, readOnly }) => ({
      name,
      description,
      readOnly,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Validated execution. `llmArgs` come from the model (untrusted); `trusted` come from the
   * server (e.g. userId) and always win. Throws on unknown tool / write-tool-without-
   * allowance — the static critic, mirroring the reference repo's DB-safety layer.
   */
  async safeCall(
    name: string,
    llmArgs: Record<string, unknown> = {},
    trusted: Record<string, unknown> = {},
    opts: { allowWrites?: boolean } = {},
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" is not registered.`);
    if (!tool.readOnly && !opts.allowWrites) {
      throw new Error(
        `Tool "${name}" performs writes and was not explicitly allowed.`,
      );
    }
    const safeArgs: Record<string, unknown> = {};
    for (const key of tool.argKeys) {
      if (llmArgs[key] !== undefined) safeArgs[key] = llmArgs[key];
    }
    return tool.run({ ...safeArgs, ...trusted }); // trusted server values override anything
  }
}
