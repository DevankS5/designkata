# AI usage

I used **Claude Code** as my coding assistant: I set the design and constraints, used it to write most of the implementation and first drafts of the docs, and reviewed the result against 171 tests in CI. Inside the product, **DeepSeek v4.1 Flash via OpenRouter** is the rubric reviewer.

The decisions that mattered most:

1. **Submission format.** I chose guided notes plus a Mermaid class diagram over a drawing canvas. Text can be parsed for deterministic checks and diffed between versions, which is what makes the blast radius possible.
2. **Research.** I skipped a poll and measured LLM feedback directly instead. At temperature 0 a bare "rate it 1 to 10" score was repeatable but never said what to fix, so I moved the thesis from "consistent feedback" to "specific, checkable feedback".
3. **Model.** I picked OpenRouter so the provider is one environment variable. Reasoning on and off gave the same levels, 15 s vs 41 s, so it is off by default.
4. **Trusting the reviewer.** The model must quote evidence before picking a level, and code verifies every quote against the learner's text. The verifier caught the model quoting our own rule findings as the learner's words; I tightened the prompt and kept the check.
5. **Concurrency bug.** The first worker version could report idle while still claiming a job, which showed up as a flaky test. I fixed the root cause (`drain()` now waits for a running pass) instead of loosening the test.

One rule of mine is enforced by CI: no em dashes anywhere (`npm run check:text`). It caught generated code twice.
