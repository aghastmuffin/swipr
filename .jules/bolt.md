# Bolt's Journal

## 2025-02-18 - Initial Entry
**Learning:** Checking the codebase structure for potential optimizations. Starting with profiling the core processes (e.g. indexing, render loops, and state changes).
**Action:** Investigate the store, media indexing, and list/cards render loops.

## 2025-02-18 - Grouping & Edge Cases in Photo Libraries
**Learning:** When optimizing grouping computations from nested quadratic arrays to linear single-passes, edge cases where a group becomes completely empty (e.g., all photos in a month are queued for deletion) must be explicitly filtered out to match the original behavior where they were omitted entirely.
**Action:** Always verify if empty groupings are expected/allowed in the UI, and if not, add a `.filter` check after mapping or iterating to preserve exact behavior.
