// Every setting is read here, once. The rest of the code receives plain values.

export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash';

export interface LlmConfig {
  apiKey: string;
  model: string;
  reasoning: 'off' | 'low' | 'medium' | 'high';
}

export interface Config {
  port: number;
  isDev: boolean;
  mongoUri: string | undefined;
  /** Undefined when no key is set: feedback is then rules-only. */
  llm: LlmConfig | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): Config {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const reasoning = env.LLM_REASONING?.trim();
  return {
    port: Number(env.PORT) || 3000,
    isDev: argv.includes('--dev'),
    mongoUri: env.MONGO_URI?.trim() || undefined,
    llm: apiKey
      ? {
          apiKey,
          model: env.LLM_MODEL?.trim() || DEFAULT_MODEL,
          // Off by default: on the sample design it gave the same levels in 15 s instead of 41 s.
          reasoning: reasoning === 'low' || reasoning === 'medium' || reasoning === 'high' ? reasoning : 'off',
        }
      : undefined,
  };
}
