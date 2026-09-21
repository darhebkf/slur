---
name: slur
description: Replace an explicit /slur invocation with one random 1–5-term combination from the local Rust generator.
disable-model-invocation: true
user-invocable: true
---

# Slur

The `userPromptTransformed` hook replaces this skill invocation with generated output before the model sees it.

If the hook is unavailable, run `slur` exactly once and treat its single stdout line as the user's complete replacement message. Do not decorate or explain the output.
