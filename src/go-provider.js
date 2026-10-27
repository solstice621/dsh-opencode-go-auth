// Older Go providers do not register Google's transport. Zen has the same
// native transport, including OpenCode's per-conversation session header.
export function withGoogleTransport(go, zen) {
  return {
    ...go,
    stream: (model, context, options) => (model.api === 'google-generative-ai' ? zen : go).stream(model, context, options),
    streamSimple(model, context, options = {}) {
      if (model.api !== 'google-generative-ai') return go.streamSimple(model, context, options);
      if (model.id !== 'gemini-4-argon') return zen.streamSimple(model, context, options);
      const level = options.reasoning ?? 'medium';
      if (!['low', 'medium', 'high'].includes(level)) throw new Error('Gemini 4 Argon supports low, medium and high reasoning.');
      // The older SDK only recognizes Gemini 3 ids as thinkingLevel models.
      // Use its native detailed stream API to send Argon's discrete level;
      // never rename the model or send Gemini 2's thinkingBudget instead.
      return zen.stream(model, context, {
        ...options,
        maxTokens: Math.min(options.maxTokens ?? model.maxTokens, model.maxTokens),
        temperature: undefined,
        headers: { ...options.headers, ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}) },
        thinking: { enabled: true, level: level.toUpperCase() },
      });
    },
  };
}
