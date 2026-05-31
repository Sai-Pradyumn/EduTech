/**
 * Diagnostic script to check which AI providers are configured and live.
 * Run with: npm run ts-node src/scripts/check-providers.ts
 * or: npx ts-node -P tsconfig.json -r tsconfig-paths/register src/scripts/check-providers.ts
 */
import * as dotenv from 'dotenv';
import { ClaudeProvider } from '../modules/ai/providers/claude.provider';
import { GeminiProvider } from '../modules/ai/providers/gemini.provider';
import { OpenAICompatibleProvider } from '../modules/ai/providers/openai-compatible.provider';

dotenv.config();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('   AI Provider Configuration Diagnostic');
console.log('═══════════════════════════════════════════════════════════\n');

const providers = [
  {
    name: 'Claude',
    envKey: 'CLAUDE_API_KEY',
    value: process.env.CLAUDE_API_KEY,
  },
  {
    name: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    value: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  },
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    value: process.env.GROQ_API_KEY,
  },
  {
    name: 'Mistral',
    envKey: 'MISTRAL_API_KEY',
    value: process.env.MISTRAL_API_KEY,
  },
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    value: process.env.OPENROUTER_API_KEY,
  },
  {
    name: 'DeepSeek',
    envKey: 'DEEPSEEK_API_KEY',
    value: process.env.DEEPSEEK_API_KEY,
  },
  { name: 'OpenAI', envKey: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
];

console.log('📋 Configuration from .env:\n');
let liveCount = 0;
providers.forEach((p) => {
  const isConfigured = !!p.value && p.value.trim().length > 0;
  const prefix = isConfigured
    ? '✅ CONFIGURED'
    : '❌ NOT SET';
  const masked = isConfigured && p.value ? `${p.value.slice(0, 8)}...` : '(empty)';
  console.log(`  ${prefix}  ${p.name.padEnd(12)} = ${masked}`);
  if (isConfigured) liveCount++;
});

console.log(`\n📊 Summary: ${liveCount}/${providers.length} providers configured\n`);

// Test each provider's isLive status
console.log('🧪 Testing provider initialization:\n');
const testProviders = [
  new ClaudeProvider(
    process.env.CLAUDE_API_KEY ?? '',
    process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    2048
  ),
  new GeminiProvider(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    2048
  ),
  new OpenAICompatibleProvider(
    {
      name: 'groq',
      label: 'Groq',
      apiKey: process.env.GROQ_API_KEY ?? '',
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      baseURL: 'https://api.groq.com/openai/v1',
    },
    2048
  ),
  new OpenAICompatibleProvider(
    {
      name: 'mistral',
      label: 'Mistral',
      apiKey: process.env.MISTRAL_API_KEY ?? '',
      model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
      baseURL: 'https://api.mistral.ai/v1',
    },
    2048
  ),
];

testProviders.forEach((p) => {
  const status = p.isLive ? '✅ LIVE' : '❌ OFFLINE';
  console.log(`  ${status}  ${p.name}`);
});

const liveProviders = testProviders.filter((p) => p.isLive);
console.log(
  `\n✨ Result: ${liveProviders.length} provider(s) ready for use\n`
);

if (liveProviders.length === 0) {
  console.log(
    '⚠️  NO PROVIDERS CONFIGURED! The app will use MOCK AI responses.'
  );
  console.log(
    '    Set at least one API key in your .env file and restart the app.\n'
  );
  process.exit(1);
} else {
  console.log(
    `✅ All good! The app will use real API calls via: ${liveProviders.map((p) => p.name).join(', ')}\n`
  );
  process.exit(0);
}
