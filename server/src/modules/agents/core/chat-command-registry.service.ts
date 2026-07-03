import { Injectable, Logger } from '@nestjs/common';
import { DomainKey } from '../../../common/domain-keys';
import { ContextEngineService } from './context-engine.service';

/**
 * Default invalidation receipt per command namespace — the domains a write in that
 * feature realistically changes downstream. A command may still override with its
 * own `affects`. This is what makes "mark week 2 done" refresh Today + the dashboard,
 * not just the roadmap.
 */
const DOMAIN_DEFAULTS: Record<string, DomainKey[]> = {
  // Upstream changes (roadmap/flows/mistakes) don't list 'dailyPlan' directly — Today
  // watches those domains and *regenerates* its plan, whereas a direct 'dailyPlan'
  // signal (from daily_plan.* commands, which already mutated the plan) just reloads.
  roadmap: ['roadmap', 'dashboard', 'intelligence'],
  daily_plan: ['dailyPlan', 'dashboard'],
  mistakes: ['mistakes', 'dashboard', 'intelligence'],
  flows: ['flows', 'dashboard'],
  course: ['course', 'dashboard'],
  memory: ['memory'],
};

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
  /** Domains this write touched — the client refreshes screens bound to them. */
  affects?: DomainKey[];
}

/**
 * A write-capable command that natural language in ANY chat can trigger.
 * `match` must be deterministic and precision-first: a missed command costs a
 * click, a wrong write costs trust — so only unambiguous phrasings match.
 */
export interface ChatCommand {
  name: string;
  description: string;
  /** Canonical phrasings that match — used by the "did you mean" suggester. */
  examples?: string[];
  /** Domains this command's writes affect — applied to its result as the default
   *  invalidation receipt (a result may still override with its own `affects`). */
  affects?: DomainKey[];
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

  list(): { name: string; description: string; examples: string[] }[] {
    return this.commands.map(({ name, description, examples }) => ({
      name,
      description,
      examples: examples ?? [],
    }));
  }

  /** True when some registered matcher would fire for this text (nothing executes). */
  wouldMatch(message: string): boolean {
    return this.commands.some((c) => {
      try {
        return c.match(message) !== null;
      } catch {
        return false;
      }
    });
  }

  /**
   * Run the write commands in a message. A single clause runs the first matching
   * command (one change per clause keeps confirmations unambiguous). A compound
   * message split by explicit connectors ("do X; then Y", newlines) runs one
   * command PER clause — so "mark week 2 complete; log recursion as a weak area"
   * really does both — while a distinct command runs at most once. Failures degrade
   * to an honest "couldn't do it" result, never a failed turn.
   */
  async detectAndExecute(
    userId: string,
    message: string,
  ): Promise<ChatCommandResult[]> {
    const clauses = this.splitClauses(message);
    const results: ChatCommandResult[] = [];
    const usedCommands = new Set<string>();
    for (const clause of clauses) {
      const result = await this.runFirstMatch(userId, clause, usedCommands);
      if (result) results.push(result);
      if (results.length >= 4) break; // bound the fan-out
    }
    return results;
  }

  /** Run the first (unused) command that matches `message`, or null if none. */
  private async runFirstMatch(
    userId: string,
    message: string,
    usedCommands: Set<string>,
  ): Promise<ChatCommandResult | null> {
    for (const command of this.commands) {
      if (usedCommands.has(command.name)) continue;
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
        if (result.ok) {
          this.contextEngine.invalidate(userId);
          usedCommands.add(command.name);
          // Default the invalidation receipt from the command's declared domains,
          // else from its namespace (roadmap.* → roadmap/dashboard/intelligence/…).
          if (!result.affects) {
            result.affects =
              command.affects ?? DOMAIN_DEFAULTS[command.name.split('.')[0]];
          }
        }
        return result;
      } catch (err) {
        this.logger.warn(
          `[CHAT-COMMAND] "${command.name}" failed: ${(err as Error).message}`,
        );
        return {
          ok: false,
          summary: `I tried to ${command.description.toLowerCase()}, but it failed — nothing was changed.`,
        };
      }
    }
    return null;
  }

  /**
   * Split a message into imperative clauses on EXPLICIT connectors only —
   * semicolons, newlines, "and then", "and also", "then". Deliberately not a bare
   * "and" (it lives inside real command args like "async and await"), so a single
   * command is never split apart.
   */
  private splitClauses(message: string): string[] {
    const parts = message
      .split(/\s*(?:;|\n|\band then\b|\band also\b|\bthen\b)\s*/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
    return parts.length > 1 ? parts : [message.trim()];
  }
}
