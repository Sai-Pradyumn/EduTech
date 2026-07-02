import { Injectable, Logger } from '@nestjs/common';
import { ContextEngineService } from './context-engine.service';

/** The outcome of a real state change executed from a chat message. */
export interface ChatCommandResult {
  ok: boolean;
  /** Honest, past-tense summary shown to the learner ("Marked Week 2 complete…"). */
  summary: string;
  /** Client route to review the change (rendered as an action chip). */
  route?: string;
  routeLabel?: string;
  /** Inverse command — rendered as an "Undo" chip that sends this text back through chat. */
  undo?: { text: string };
}

/**
 * A write-capable command that natural language in ANY chat can trigger.
 * `match` must be deterministic and precision-first: a missed command costs a
 * click, a wrong write costs trust — so only unambiguous phrasings match.
 */
export interface ChatCommand {
  name: string;
  description: string;
  /** Returns extracted params when the message clearly asks for this command. */
  match(message: string): Record<string, unknown> | null;
  execute(
    userId: string,
    params: Record<string, unknown>,
  ): Promise<ChatCommandResult>;
}

/**
 * Chat Command Registry — "saying it makes it happen". Feature modules register
 * commands at init (same registrar pattern as agent tools); the orchestrator runs
 * detection on every chat message BEFORE agents compose, so replies can honestly
 * confirm what already changed instead of promising to do it. A successful command
 * invalidates the learner's context snapshot so the very same turn sees the new
 * state (e.g. the next roadmap week becomes "current").
 */
@Injectable()
export class ChatCommandRegistryService {
  private readonly logger = new Logger(ChatCommandRegistryService.name);
  private readonly commands: ChatCommand[] = [];

  constructor(private readonly contextEngine: ContextEngineService) {}

  register(command: ChatCommand): void {
    this.commands.push(command);
  }

  list(): { name: string; description: string }[] {
    return this.commands.map(({ name, description }) => ({
      name,
      description,
    }));
  }

  /**
   * First matching command wins (one state change per message keeps confirmations
   * unambiguous). A command failure degrades to an honest "couldn't do it" result —
   * never a failed chat turn.
   */
  async detectAndExecute(
    userId: string,
    message: string,
  ): Promise<ChatCommandResult[]> {
    for (const command of this.commands) {
      let params: Record<string, unknown> | null = null;
      try {
        params = command.match(message);
      } catch {
        continue; // a broken matcher must never break the turn
      }
      if (!params) continue;

      this.logger.log(
        `[CHAT-COMMAND] "${command.name}" matched — executing for user ${userId}`,
      );
      try {
        const result = await command.execute(userId, params);
        if (result.ok) this.contextEngine.invalidate(userId);
        return [result];
      } catch (err) {
        this.logger.warn(
          `[CHAT-COMMAND] "${command.name}" failed: ${(err as Error).message}`,
        );
        return [
          {
            ok: false,
            summary: `I tried to ${command.description.toLowerCase()}, but it failed — nothing was changed.`,
          },
        ];
      }
    }
    return [];
  }
}
