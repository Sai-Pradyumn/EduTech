import {
  ChatCommand,
  ChatCommandResult,
} from '../agents/core/chat-command-registry.service';
import { FlowsChatCommands } from './flows-chat-commands';

/**
 * Flow chat commands — matcher precision + node resolution + honest outcomes.
 * Hermetic: fake registry + fake FlowsService.
 */
describe('FlowsChatCommands', () => {
  const flowId = 'f1';

  const node = (id: string, title: string, status = 'available') => ({
    id,
    title,
    summary: '',
    status,
    prerequisites: [] as string[],
  });

  function build(
    flow: Record<string, unknown> | null,
    saved?: Record<string, unknown>,
  ) {
    const commands: ChatCommand[] = [];
    const registry = { register: (c: ChatCommand) => commands.push(c) };
    const flows = {
      findActive: jest.fn().mockResolvedValue(flow),
      updateNode: jest
        .fn()
        .mockResolvedValue(saved ?? { nodes: [], progressPercentage: 50 }),
    };
    new FlowsChatCommands(registry as never, flows as never).onModuleInit();
    return { commands, flows };
  }

  const run = async (
    commands: ChatCommand[],
    message: string,
  ): Promise<ChatCommandResult | null> => {
    for (const c of commands) {
      const params = c.match(message);
      if (params) return c.execute('u1', params);
    }
    return null;
  };

  const activeFlow = () => ({
    _id: flowId,
    title: 'Backend mastery',
    nodes: [
      node('n1', 'JavaScript closures', 'available'),
      node('n2', 'Event loop deep dive', 'completed'),
    ],
  });

  it('completes a node by fuzzy title and offers the reopen undo', async () => {
    const savedFlow = {
      nodes: [
        node('n1', 'JavaScript closures', 'completed'),
        { ...node('n3', 'Async patterns', 'available'), prerequisites: ['n1'] },
      ],
      progressPercentage: 40,
    };
    const { commands, flows } = build(activeFlow(), savedFlow);

    const result = await run(commands, "mark 'closures' complete in my flow");
    expect(result?.ok).toBe(true);
    expect(flows.updateNode).toHaveBeenCalledWith('u1', flowId, 'n1', {
      status: 'completed',
    });
    expect(result?.summary).toContain('JavaScript closures');
    expect(result?.summary).toContain('40%');
    expect(result?.summary).toContain('Async patterns'); // unlocked
    expect(result?.undo?.text).toBe("reopen 'JavaScript closures' in my flow");
  });

  it('reopens a completed node with the complete undo', async () => {
    const { commands, flows } = build(activeFlow(), {
      nodes: [],
      progressPercentage: 0,
    });
    const result = await run(commands, "reopen 'event loop' in my flow");
    expect(result?.ok).toBe(true);
    expect(flows.updateNode).toHaveBeenCalledWith('u1', flowId, 'n2', {
      status: 'available',
    });
    expect(result?.undo?.text).toBe(
      "mark 'Event loop deep dive' complete in my flow",
    );
  });

  it('never matches questions, plan check-offs or roadmap wordings', async () => {
    const { commands } = build(activeFlow());
    for (const msg of [
      'should I mark closures complete in my flow?',
      "check off 'revise recursion'",
      'mark week 2 as complete',
      'mark the fundamentals as completed',
    ]) {
      expect(await run(commands, msg)).toBeNull();
    }
  });

  it('is honest when there is no active flow or no matching node', async () => {
    const none = build(null);
    const noFlow = await run(none.commands, "mark 'closures' done in my flow");
    expect(noFlow?.ok).toBe(false);
    expect(noFlow?.summary).toContain("don't have an active flow");

    const { commands, flows } = build(activeFlow());
    const noNode = await run(
      commands,
      "mark 'quantum computing' done in my flow",
    );
    expect(noNode?.ok).toBe(false);
    expect(noNode?.summary).toContain('nothing was changed');
    expect(flows.updateNode).not.toHaveBeenCalled();
  });

  it('treats an already-complete node as a no-op, without an undo chip', async () => {
    const { commands, flows } = build(activeFlow());
    const result = await run(commands, "mark 'event loop' done in my flow");
    expect(result?.ok).toBe(true);
    expect(result?.summary).toContain('already complete');
    expect(result?.undo).toBeUndefined();
    expect(flows.updateNode).not.toHaveBeenCalled();
  });
});
