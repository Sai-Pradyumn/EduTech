/**
 * Domains an Asta state-change can affect (the app-wide invalidation vocabulary).
 * A chat command declares which of these it touched; the orchestrator unions them
 * into `AgentResponse.invalidate`, and the client's DomainBus refreshes any open
 * screen bound to those domains — so "mark week 2 done" in chat updates the roadmap,
 * Today and the dashboard at once, instead of leaving them stale until a reload.
 */
export type DomainKey =
  | 'roadmap'
  | 'dailyPlan'
  | 'dashboard'
  | 'intelligence'
  | 'mistakes'
  | 'course'
  | 'flows'
  | 'skillTwin'
  | 'ledger'
  | 'memory'
  | 'profile';

/** De-duped union of affected domains. */
export function mergeDomains(lists: (DomainKey[] | undefined)[]): DomainKey[] {
  return [...new Set(lists.flatMap((l) => l ?? []))];
}
