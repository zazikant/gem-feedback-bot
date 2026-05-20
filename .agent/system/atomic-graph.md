# Atomic Graph — gem-feedback-bot

**Date:** 2026-05-20
**Validation Score:** 0.78 (above 0.75 threshold)

---

## Nodes

| ID | Title | Summary | Tags |
|----|-------|---------|------|
| c1 | Next.js feedback bot | Implements a feedback interface using LangGraph state machine to drive conversation. | project, framework |
| c2 | Duplicate frontend pages | Main and widget pages contain nearly identical flow logic, causing redundancy. | duplication, frontend |
| c3 | Missing shared hook | No common hook abstracts duplicated flow, leading to repeated code. | abstraction, hook |
| c4 | Dual state stores | graph.ts maintains both an in-memory Map and a MemorySaver checkpointer, creating inconsistent state sources. | state, store |
| c5 | Rating persistence mismatch | In-memory store keeps rating across calls while checkpointer never aggregates full state, causing data loss. | bug, state |
| c6 | Graph-executor mismatch | Defined graph ends at END but executor manually re-invokes graph, contradicting intended flow. | architecture, execution |
| c7 | Unused Prisma DB layer | db.ts and Prisma are present but never accessed, adding dead code. | deadcode, database |
| c8 | Global Toaster import | layout.tsx loads toast components globally though no page uses them, inflating bundle size. | bloat, ui |
| c9 | Unused sidebar UI imports | sidebar.tsx imports many UI components that feedback pages never use, creating unnecessary dependencies. | bloat, ui |
| c10 | Mutable SMTP transporter | smtp.ts creates transporter as mutable module variable and reads env vars at call time, risking inconsistent configuration. | resource, init |
| c11 | Widget global mutable state | widget.js relies on shared mutable variables without encapsulation, leading to coupling and side effects. | state, coupling |
| c12 | Feedback flow steps | Defined sequence INIT-askRating-validateRating-askFeedback-captureAndSend-thankYou governs user interaction. | flow, steps |
| c13 | Invalid input loop | Validation failures or email errors cause the flow to loop back, potentially trapping users. | error, loop |
| c14 | Frontend feedback API | Client POSTs sessionId, userInput, and currentStep to /api/feedback, expecting a structured response. | api, contract |
| c15 | Backend response payload | Returns botMessage, nextStep, rating, and emailSent status to guide next client action. | api, response |
| c16 | Single source of truth | Consolidating state into one store eliminates inconsistencies and simplifies reasoning. | design, state |
| c17 | Extract shared hook | Refactor duplicated logic into a reusable hook to reduce code duplication. | refactor, hook |
| c18 | Align executor with graph | Remove manual re-invocation and let the graph handle step progression naturally. | architecture, executor |
| c19 | Remove dead DB code | Delete db.ts and Prisma imports to clean codebase and reduce bundle size. | cleanup, database |
| c20 | Eliminate unnecessary toasts | Delete global toast imports and usage where not needed. | cleanup, ui |
| c21 | Prune unused UI imports | Strip sidebar's unused component imports to streamline dependencies. | cleanup, ui |
| c22 | Initialize SMTP once | Create transporter at module load with env vars, avoiding mutable reinitialization. | resource, init |
| c23 | Encapsulate widget state | Wrap widget variables in a closure or component state to prevent global side effects. | encapsulation, state |
| c24 | Robust email error handling | Implement explicit handling for email failures to avoid silent loops. | error, handling |
| c25 | Terminate feedback loop | Ensure flow reaches thankYou and stops, preventing infinite repetitions. | flow, termination |
| c26 | SessionId based tracking | Use sessionId to correlate user steps across requests, enabling stateless server design. | session, tracking |

---

## Edges

| Source | Target | Label | Strength | Meaning |
|--------|--------|-------|----------|---------|
| c1 | c12 | enables | 0.9 | The project enables the feedback flow |
| c12 | c14 | requires | 0.9 | Steps require the frontend API |
| c14 | c15 | produces | 0.9 | API produces the response payload |
| c3 | c2 | causes | 0.9 | Missing hook causes duplication |
| c2 | c3 | drives | 0.8 | Duplication drives the need for a hook |
| c4 | c5 | creates | 0.9 | Dual stores create persistence mismatch |
| c6 | c4 | causes | 0.7 | Executor mismatch causes dual state |
| c5 | c13 | exacerbates | 0.7 | Mismatch exacerbates loops |
| c25 | c13 | disables | 0.9 | Termination fix disables infinite loops |
| c25 | c12 | terminates | 0.8 | Termination ensures flow completes |
| c16 | c4 | enforces | 0.9 | Single source enforces one store |
| c16 | c5 | resolves | 0.9 | Single source resolves persistence mismatch |
| c17 | c2 | remedies | 0.9 | Shared hook remedies duplication |
| c17 | c3 | provides | 0.9 | Shared hook provides the missing abstraction |
| c18 | c6 | aligns | 0.9 | Graph alignment fixes executor mismatch |
| c19 | c7 | removes | 0.9 | Removal fix eliminates dead DB code |
| c20 | c8 | eliminates | 0.9 | Elimination fix removes global Toaster |
| c21 | c9 | prunes | 0.9 | Pruning fix strips unused imports |
| c22 | c10 | replaces | 0.9 | Eager init replaces mutable lazy pattern |
| c24 | c10 | hardens | 0.8 | Error handling hardens SMTP reliability |
| c23 | c11 | encapsulates | 0.9 | Encapsulation fixes global mutable state |
| c26 | c12 | enables | 0.8 | Session tracking enables flow correlation |

---

## Edge Strength Legend

| Strength | Color | Meaning |
|----------|-------|---------|
| >= 0.7 | Bright purple | Strong connection |
| 0.4-0.69 | Indigo/blue | Moderate connection |
| < 0.4 | Gray | Weak / speculative |

## Node Fields Legend

| Field | Meaning |
|-------|---------|
| `id` | Unique identifier (c1-c26) |
| `title` | Short concept name (2-5 words) |
| `summary` | Why the concept matters (1-2 sentences) |
| `tags` | Keywords for grouping and color clustering |
| `cluster` | Auto-assigned color group (by shared tags) |

---

## Problem Nodes (Red/Brown Cluster)

c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c13

## Fix Nodes (Green Cluster)

c16, c17, c18, c19, c20, c21, c22, c23, c24, c25

## Core Flow Nodes (Blue Cluster)

c1, c12, c14, c15, c26

---

## Validation Details

- **Score:** 0.78
- **Method:** Atomic Graph pipeline (EXTRACT → LINK → VALIDATE → REFINE)
- **Remaining issues (minor):** Some fix nodes have overlapping targets (c22 and c24 both target c10 at different scopes — c22 replaces the pattern, c24 adds error resilience on top)
- **All problem nodes now have explicit fix edges for traceability**