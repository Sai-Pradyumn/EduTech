import { Injectable, Logger } from '@nestjs/common';

export type AgentTool = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolDescriptor {
  name: string;
  description: string;
  run: AgentTool;
}

/**
 * Central registry of callable agent tools. Feature modules register tools at
 * init (wrapping their services) so agents call them without re-wiring deps.
 */
@Injectable()
export class AgentToolRegistryService {
  private readonly logger = new Logger(AgentToolRegistryService.name);
  private readonly tools = new Map<string, ToolDescriptor>();

  register(descriptor: ToolDescriptor): void {
    this.tools.set(descriptor.name, descriptor);
  }

  list(): { name: string; description: string }[] {
    return [...this.tools.values()].map(({ name, description }) => ({ name, description }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      this.logger.warn(`Tool "${name}" not found`);
      return null;
    }
    return tool.run(args);
  }
}
