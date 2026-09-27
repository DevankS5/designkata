# Research note: practising LLD with feedback you can check

Devank Srivastava · CipherSchools engineering assignment · September 2026

## 1. The learner problem

I learned low-level design the way most students around me did: a YouTube walkthrough of Parking Lot, then the solution in a GitHub repository. When my design looked different from theirs, I could not tell whether it was wrong or just different. For DSA, LeetCode's judge settles that in a second. **For LLD there is no judge**, so I either copied the reference or guessed.

That gap has three consequences for a learner:

1. **Reference matching.** With one solution to compare against, a valid alternative looks like a mistake, and a copied design looks like a good one.
2. **The follow-up is never practised.** Real rounds test how a design absorbs change. workat.tech lists "Code should easily accommodate new requirements with minimal changes" as an expectation in machine coding rounds at Flipkart, Uber and Swiggy [1], and Hello Interview notes that "most interviews include a small follow-up requirement" [2]. Solo practice almost never includes one.
3. **Nothing remembers my mistakes.** Every attempt starts from zero, so the same weakness (one class doing everything) comes back problem after problem.

## 2. What exists today

| Tool | What the learner submits | Feedback | Gap for a learner like me |
|---|---|---|---|
| LeetCode "Design Parking System" (Easy) [3] | Code for `addCar(carType)` | Pass or fail on tests | Checks behaviour, not design. The whole problem fits in three counters. |
| awesome-low-level-design, GitHub, 27k stars [4] | Nothing | Reference solutions in several languages | Compare-to-reference only. The most popular LLD resource has no feedback at all. |
| AlgoMaster LLD, 33 problems [5] | Nothing | Written solutions; premium tier | Same: learn by reading, check by comparing. |
| Codemia OOD, 50+ problems [6] | A design on the platform | Editorial solutions; AI feedback is marketed for system design | Unclear for OOD, and paid. |
| Hello Interview LLD Guided Practice [7] | Answers to each interview step | "Personalized feedback" | Premium and desktop only. Not built for students in India. |
| A general chatbot (ChatGPT, Claude) | Anything | A score and free text if asked | See the experiment below. |
| A human mock interview | A live discussion | The best feedback there is | Expensive and scarce. |

Learners say the same thing in their own words. A Hello Interview community thread is titled "Preparing for Low-Level Object-Oriented Design (LLD) feels incredibly non-trivial and disjointed" [8], and r/leetcode threads look for study partners because nobody else is there to give feedback on a design [9].

## 3. A small experiment: what does an LLM actually tell you?

I gave the same flawed Parking Lot design (one class that parks, prices, takes payment and prints receipts) to `deepseek/deepseek-v4.1-flash` five times in each of three ways, and then repeated the whole run with the model's reasoning switched off (`npm run experiment:consistency`):

| Setup | Run 1 (reasoning on) | Run 2 (reasoning off) |
|---|---|---|
| A. "Rate it from 1 to 10", default temperature, like a chat app | 5, 6, 5, 5, 4 | 6, 6, 6, 6, 6 |
| B. The same question at temperature 0 | 5, 5, 5, 5, 5 | 6, 6, 6, 6, 6 |
| C. DesignKata's rubric at temperature 0 | 5 of 6 criteria gave the same level every time; 46 of 47 quotes found word for word | 5 of 6 the same every time; 66 of 68 quotes found |

The surprise for me: **a bare score is easy to make repeatable**. Temperature 0 did it, and so did turning reasoning off. But the score moved from 5 to 6 when one setting changed, and "6 out of 10" still does not say *what* to change. The rubric named the same two faults (one class doing everything, pricing that cannot vary) at level 1 in 19 of 20 judgments, and code could verify 112 of its 115 quotes. So consistency was never the real gap; **specific, checkable feedback** is. That shaped the product more than any competitor did. Raw output is in `docs/experiments/`.

## 4. Gaps worth solving

1. **No judge.** Learners need a verdict per quality, not one number and not one reference answer.
2. **Unverifiable feedback.** An LLM's claims about a design should point at the learner's own words, and those pointers should be checked.
3. **Change is not practised or measured**, even though it is what interviewers probe.
4. **No memory.** Weaknesses should be tracked across attempts.
5. **Access.** The tools that give feedback are paid and priced for other markets. CipherSchools' learners are students in India.

## 5. Product direction: DesignKata

**One loop:** pick a problem, design, submit, get feedback, then revise or take the twist.

- **Submission:** five short guided notes (requirements, entities, flows, trade-offs, edge cases) plus a class diagram written as Mermaid text. This is the smallest format that shows both the reasoning and the structure. It is also machine-readable, which a drawing is not, and it takes less time than full code.
- **Feedback you can check:** deterministic rules catch structural problems instantly and for free. An LLM then judges six rubric criteria on anchored levels from 1 to 4. It must quote the learner for every judgment, and code verifies that each quote really exists. There is no overall score.
- **The twist:** after the first review, the learner gets an interviewer-style new requirement. DesignKata diffs the two class diagrams and reports the blast radius: how many existing classes had to change. This is how a design can be judged by how it absorbs change, instead of by how close it is to a reference.
- **History:** every version is kept, with per-criterion levels over time and the weaknesses that keep coming back.
- **Not in the MVP:** accounts, code or hand-drawn submissions, an admin panel, leaderboards.

**Sources.**
- [1] workat.tech, "What is a Machine Coding Round?"
- [2] Hello Interview, "Low Level Design in a Hurry"
- [3] leetcode.com/problems/design-parking-system
- [4] github.com/ashishps1/awesome-low-level-design (27,064 stars on 26 Sep 2026)
- [5] algomaster.io/learn/lld
- [6] codemia.io/object-oriented-design
- [7] hellointerview.com/practice/low-level-design
- [8] hellointerview.com/community/discussion/low-level-design-preparation
- [9] r/leetcode, "Master LLD for interviews and looking for study buddies"
