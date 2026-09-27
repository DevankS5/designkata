# Decision log

The decisions that shaped DesignKata, in the order they were made. "Proposed by" is honest about where an idea came from. I built this with Claude Code as my pair, so many first proposals came from it. "Decided by" is who made the call.

---

### 1. What a learner submits: short notes plus a class diagram written as Mermaid text

- **Options:** free text only; code; a drawing tool; notes plus diagram-as-text.
- **Chosen:** five guided note sections plus a Mermaid `classDiagram`.
- **Why:** it is the smallest format that shows both reasoning (the notes) and structure (the diagram). The diagram is text, so it can be parsed (deterministic checks) and diffed between versions (the blast radius). A drawing tool would cost days and produce pixels, not structure. Full code is too slow for a 45-minute practice and pulls attention to implementation.
- **Proposed by:** Claude. **Decided by:** me, when I approved the plan.

### 2. Anchored levels per criterion, no overall score

- **Chosen:** six criteria, each on four levels, and each level described in words. No total.
- **Why:** the brief warns against "a 100-point score", and a total hides where to improve. Anchors let two different designs both reach level 4.
- **Proposed by:** Claude. **Decided by:** me.

### 3. MongoDB with Mongoose, not SQLite

- **Options:** SQLite (zero setup) or MongoDB (CipherSchools' MERN stack, and my own).
- **Chosen:** MongoDB. A local MongoDB starts automatically when `MONGO_URI` is not set, so nobody has to install anything.
- **Why:** it is the team's stack and it is on my résumé. The evaluation lives inside the submission document, so storing a submission and queueing its review is one atomic write.
- **Proposed by:** Claude (as its recommendation). **Decided by:** me.

### 4. OpenRouter with DeepSeek v4.1 Flash

- **Options offered:** Gemini's free tier, a Claude key, or no key.
- **Chosen:** none of those. I used OpenRouter, so the model is one environment variable, with `deepseek/deepseek-v4.1-flash`.
- **Why:** I had an OpenRouter key, and it keeps the provider swappable. The model supports strict JSON-schema output.
- **Proposed by:** me.

### 5. No classmate poll; an experiment instead

- **Claude proposed:** a four-question poll in my college groups as primary research.
- **Decided by:** me. No poll, desk research only.
- **What replaced it:** Claude suggested measuring LLM feedback directly, and I agreed. Its own hypothesis was that LLM scores are inconsistent. **The data said otherwise:** at temperature 0 a bare 1-10 score was perfectly repeatable. That moved the product's thesis from "consistent feedback" to "specific, checkable feedback". See `docs/experiments/`.

### 6. Evidence first, and every quote verified by code

- **Chosen:** the answer schema lists evidence before the level, so the model quotes before it decides. Code then checks every quote against the learner's own text.
- **Why:** feedback should point at evidence (the helping guide says so), and a model can invent evidence.
- **Found in testing:** in the browser, the verifier flagged a quote the reviewer took from *our* rule findings and presented as the learner's words. The prompt now forbids quoting anything outside `<submission>`, and the verifier stays as the safety net.
- **Proposed by:** Claude. **Decided by:** me.

### 7. The twist, measured as a blast radius

- **Chosen:** after the first review, an interviewer-style new requirement. The two class diagrams are diffed and the existing classes that had to change are counted.
- **Why:** this is how a design can be judged by how it absorbs change, not by how close it is to a reference. workat.tech lists "accommodate new requirements with minimal changes" as a machine-coding expectation.
- **Proposed by:** Claude. **Decided by:** me.

### 8. Model reasoning off by default

- **Measured:** on the sample design, reasoning off returned the same six levels in 15 seconds instead of 41, with 14 of 14 quotes verified.
- **Chosen:** off by default; `LLM_REASONING` turns it back on.
- **Decided by:** the numbers. Claude ran both configurations and I kept the faster one.

### 9. An in-process worker with leases, not a queue service

- **Chosen:** MongoDB is the queue. Claims are compare-and-set, and a lease expires if a worker dies.
- **Why:** the brief asks for a monolith. The claim works the way a real queue's does, so BullMQ or SQS can replace it without touching the practice flow.
- **Found in testing:** Claude's first version of `drain()` could return while a pass was still claiming work. A flaky integration test exposed it, and the root cause was fixed in the worker, not in the test.

### 10. No repository interfaces

- **Chosen:** repositories are concrete classes.
- **Why:** there is one implementation of each, and TypeScript's structural typing lets tests pass a fake without an interface. The interfaces that do exist (`Evaluator`, `ArtifactReader`, `LlmClient`, `Rule`) each have at least two implementations today.
- **Proposed by:** Claude. **Decided by:** me.

### 11. No em dashes anywhere

- **Rule:** mine.
- **Enforced by:** `npm run check:text`, which also runs in CI, and the reviewer's output is cleaned before learners see it.
- **The guard earned its place:** the file-writing tool twice turned escaped dash code points in source files into real em dash characters, and the check caught both.
