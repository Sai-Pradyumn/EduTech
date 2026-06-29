import { Logger } from '@nestjs/common';
import { Role } from '../common/enums';
import { EventsGateway } from './events.gateway';

/** A minimal socket double capturing emits + disconnects. */
function fakeClient(
  data: Record<string, unknown> = { userId: 'u1', role: Role.Student },
) {
  return {
    data,
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

type Orchestrator = { handle: jest.Mock };

function makeGateway(orchestrator: Orchestrator): EventsGateway {
  // jwt + config are only used by handleConnection, not the message path under test.
  return new EventsGateway({} as never, {} as never, orchestrator as never);
}

type EmittedEvent = { type?: string; message?: string };

const lastErrorMessage = (
  client: ReturnType<typeof fakeClient>,
): string | undefined => {
  const calls = client.emit.mock.calls as Array<[string, EmittedEvent]>;
  const call = calls.find(
    ([event, payload]) => event === 'agent.event' && payload?.type === 'error',
  );
  return call?.[1].message;
};

describe('EventsGateway — agent.send hardening', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterAll(() => {
    Logger.overrideLogger(new Logger());
  });

  it('streams the orchestrator result and acks ok on success', async () => {
    const orchestrator = {
      handle: jest.fn().mockResolvedValue({ sessionId: 's1', messageId: 'm1' }),
    };
    const gw = makeGateway(orchestrator);
    const client = fakeClient();

    const ack = await gw.onAgentSend(client as never, { message: 'hi' });

    expect(ack).toEqual({ ok: true, sessionId: 's1' });
    expect(orchestrator.handle).toHaveBeenCalledTimes(1);
    expect(client.data.busy).toBe(false); // cleared in finally
  });

  it('emits a terminal error event when the orchestrator throws (no UI hang)', async () => {
    const orchestrator = {
      handle: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const gw = makeGateway(orchestrator);
    const client = fakeClient();

    const ack = await gw.onAgentSend(client as never, { message: 'hi' });

    expect(ack).toEqual({ ok: false });
    // The fix: a terminal error event must reach the client so the stream completes.
    expect(lastErrorMessage(client)).toMatch(/could not finish/i);
    expect(client.data.busy).toBe(false);
  });

  it('rejects an over-long message without calling the orchestrator', async () => {
    const orchestrator = { handle: jest.fn() };
    const gw = makeGateway(orchestrator);
    const client = fakeClient();

    const ack = await gw.onAgentSend(client as never, {
      message: 'x'.repeat(4001),
    });

    expect(ack).toEqual({ ok: false });
    expect(orchestrator.handle).not.toHaveBeenCalled();
    expect(lastErrorMessage(client)).toMatch(/too long/i);
  });

  it('rejects a second concurrent send while one is in flight', async () => {
    const orchestrator = { handle: jest.fn() };
    const gw = makeGateway(orchestrator);
    const client = fakeClient({ userId: 'u1', role: Role.Student, busy: true });

    const ack = await gw.onAgentSend(client as never, { message: 'hi' });

    expect(ack).toEqual({ ok: false });
    expect(orchestrator.handle).not.toHaveBeenCalled();
    expect(lastErrorMessage(client)).toMatch(/still answering/i);
  });

  it('ignores empty messages', async () => {
    const orchestrator = { handle: jest.fn() };
    const gw = makeGateway(orchestrator);
    const client = fakeClient();

    const ack = await gw.onAgentSend(client as never, { message: '   ' });

    expect(ack).toEqual({ ok: false });
    expect(orchestrator.handle).not.toHaveBeenCalled();
  });
});
