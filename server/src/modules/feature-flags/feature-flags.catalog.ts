/** Centralized feature-flag registry (Phase 10 · M16). Defaults ship enabled unless a flag
 *  gates an expensive/paid path; admins flip them at runtime and changes are audited. */

export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Plans this flag is allowed for ([] = all plans). */
  allowedPlans: string[];
  /** Staged rollout percentage (0–100). 100 = everyone. */
  rolloutPercent: number;
  /** Marks an expensive AI path that admins may kill quickly. */
  killable: boolean;
  beta?: boolean;
}

export const FEATURE_FLAG_DEFS: FeatureFlagDef[] = [
  flag(
    'ENABLE_FLOW_STUDIO',
    'Flow Studio',
    'Adaptive learning-flow generation.',
  ),
  flag('ENABLE_VISUAL_STUDIO', 'Visual Studio', 'Diagram / visual generation.'),
  flag('ENABLE_VOICE', 'Voice Room', 'Voice-native tutor + sessions.'),
  flag('ENABLE_STUDY_SPACES', 'Study Spaces', 'Collaborative study spaces.'),
  flag(
    'ENABLE_SKILL_PASSPORT',
    'Skill Passport',
    'Proof-based skill passport.',
  ),
  flag('ENABLE_PORTFOLIO', 'Portfolio', 'Public portfolio pages.'),
  flag('ENABLE_MARKETPLACE', 'Marketplace', 'Mentor + template marketplace.'),
  flag(
    'ENABLE_PAYMENT_PROVIDER',
    'Live payments',
    'Real Stripe/Razorpay checkout.',
    false,
  ),
  flag(
    'ENABLE_WEB_PUSH',
    'Web push',
    'Browser push notifications.',
    false,
    true,
  ),
  flag(
    'ENABLE_OFFLINE_MODE',
    'Offline mode',
    'PWA offline learning cache.',
    true,
    true,
  ),
  flag(
    'ENABLE_DEVELOPER_API',
    'Developer API',
    'API keys + webhooks platform.',
    false,
    true,
  ),
  flag(
    'ENABLE_INTEGRATIONS',
    'Integrations',
    'External integration connectors.',
    false,
    true,
  ),
  flag(
    'ENABLE_AI_PARALLEL_STRATEGY',
    'AI parallel strategy',
    'Race providers + judge synthesis.',
    true,
    false,
    true,
  ),
  flag(
    'ENABLE_IMAGE_GENERATION',
    'Image generation',
    'Generative image outputs.',
    false,
    false,
    true,
  ),
  flag(
    'ENABLE_FINE_TUNING',
    'Fine-tuning Lab',
    'Model fine-tuning workflows.',
    true,
    false,
    true,
  ),
];

function flag(
  key: string,
  label: string,
  description: string,
  defaultEnabled = true,
  beta = false,
  killable = false,
): FeatureFlagDef {
  return {
    key,
    label,
    description,
    defaultEnabled,
    allowedPlans: [],
    rolloutPercent: 100,
    killable,
    beta,
  };
}

export const FEATURE_FLAG_KEYS = FEATURE_FLAG_DEFS.map((f) => f.key);
export function flagDef(key: string): FeatureFlagDef | undefined {
  return FEATURE_FLAG_DEFS.find((f) => f.key === key);
}
