---
type: integration
aliases: [OpenRouter, AI Provider]
---

# OpenRouter

LLM gateway — routes to GPT-4, Claude, etc. Used via the OpenAI SDK pointed at `OPENROUTER_BASE_URL`.

## Env
```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini   # default
```

## Lazy init
Pattern matches [[Razorpay]] — created on first use to avoid module-load crashes when the key is absent.

## Used by
- [[AI-Response]] — review reply drafting
- [[AI-Agent]] — orchestration / multi-step prompts
- [[RAIS]] — social post copy
- [[NEV]] — likely emotion classification path
- [[Business-Aspects]] — aspect tagging on reviews
