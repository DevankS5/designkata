# AI usage

I built DesignKata with **Claude Code** (Anthropic's coding agent) as my pair programmer. Inside the product, an LLM (**DeepSeek v4.1 Flash via OpenRouter**) is the rubric reviewer.

Who did what:
- **Claude:** wrote most of the code and the first drafts of these documents.
- **Me:** set the constraints, made the calls below, reviewed the work and used the app end to end.
- **The tests:** 171 of them, run in CI, decided whether any of it was actually right.

These are the five decisions where AI help mattered most, and what I did with each.

## 1. What a learner submits: accepted

- **Claude proposed:** short guided notes plus a class diagram written as Mermaid text, instead of a drawing canvas or full code.
- **I accepted** because the diagram being text is what makes everything else possible. It can be parsed for deterministic checks and diffed between versions for the blast radius. A canvas would have given me pixels, not structure, and taken days to build.

## 2. Primary research: a poll rejected, an experiment that proved the AI wrong

- **Claude suggested:** a short poll in my college groups.
- **I said no** and kept to desk research.
- **What we did instead:** we agreed to measure LLM feedback directly. Claude's hypothesis was that LLM scores on a design are inconsistent.
- **The data disagreed.** At temperature 0 a bare "rate it 1 to 10" score was perfectly repeatable. It did move from 5 to 6 when one setting changed, and it never said what to fix.
- **What changed:** the product's thesis moved from "consistent feedback" to "specific, checkable feedback". That is why every judgment has to quote the learner. I'd rather have the thesis corrected by a measurement than keep one that only sounds right.

## 3. The model provider: I overrode the options

- **Claude offered:** Gemini's free tier or a Claude key.
- **I chose:** OpenRouter with `deepseek/deepseek-v4.1-flash`. I had the key, and it keeps the provider one environment variable away.
- **Then we measured reasoning on against off.** The six levels were the same, in 15 seconds instead of 41. A learner is waiting for this, so reasoning is off by default.

## 4. Trusting the reviewer: evidence first, verified by code

- **Claude proposed two things:**
  - order the JSON answer so the model quotes evidence before it picks a level;
  - add a verifier that checks every quote against the learner's own text.
- **I accepted both,** and the verifier proved itself in the browser. It flagged a quote that the model had lifted from *our own rule findings* and presented as the learner's words.
- **The fix:** we tightened the prompt to quote only from the submission, and kept the verifier. My takeaway: an LLM's evidence is a claim until code checks it.

## 5. AI-written concurrency code needed a skeptic: a bug caught by tests

- **The bug:** Claude's first version of the evaluation worker could report itself idle while a pass was still claiming a job.
- **How it showed up:** every test passed on its own, but one failed now and then in the full suite.
- **The fix:** we did not loosen the test. We fixed the root cause in the worker, so `drain()` now also waits for a running pass.
- **My takeaway:** AI makes code fast, and tests plus review decide whether it is correct. The same review caught smaller things too, such as the model writing "None" as a strength, which the UI now hides.

## One more: my own rule, enforced by a machine

I set one rule for the whole project: **no em dashes anywhere**. `npm run check:text` enforces it in CI, and the reviewer's output is cleaned before learners see it.

It earned its place twice. The AI's file-writing tool turned escaped code points into real em dashes inside source files, and the check caught both times.
