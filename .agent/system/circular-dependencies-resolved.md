# Circular Dependencies Analysis — gem-feedback-bot

**Date:** 2026-05-20
**Project:** gem-feedback-bot

---

## 1. Duplicated Page Logic — `page.tsx` & `widget/page.tsx`

**Facts:**
- Both files define the same `FlowStep` type union.
- Both utilize identical state variables: `messages`, `input`, `isLoading`, `currentStep`, `sessionId`, `rating`, and `emailSent`.
- Both implement identical functions: `startConversation`, `handleSubmit`, `handleKeyDown`, and `restartSurvey`.

**Architectural Issue & Circular Maintenance Dependency:**
Consequently, any changes made in one file must be manually mirrored to the other. This creates a severe maintenance circularity; fixing a bug in one component necessitates remembering and replicating the fix in the other. Furthermore, no shared hook or component has been extracted to centralize this logic, thereby perpetuating the cycle of duplication and manual synchronization.

**Fix:** Create `src/hooks/use-feedback-flow.ts`. Move `FlowStep` type, `startConversation`, `handleSubmit`, `handleKeyDown`, and `restartSurvey` into this hook. Both pages import and use the same hook. Eliminates maintenance circularity. Single source of truth for feedback flow logic.

---

## 2. Import Tangle — `use-toast.ts` & Toast Components

**Facts:**
- `use-toast.ts` imports `ToastProps` and `ToastActionElement` from `@/components/ui/toast`.
- `toaster.tsx` imports `useToast` from `@/hooks/use-toast` alongside multiple components from `@/components/ui/toast`.

**Architectural Issue & Fragile Dependency Web:**
Although not a true circular dependency, the tight coupling chain creates a fragile dependency web. Because `toaster.tsx` relies on both the hook and the base components, any modification to the toast interface ripples unpredictably through the module graph, increasing the risk of regression.

**Fix:** Move `ToastProps` and `ToastActionElement` types to `src/types/toast.ts`. `use-toast.ts` imports from types, not from component. `toast.tsx` imports from types independent of hook. Breaks the import tangle while keeping `cn` imports from utils unchanged.

---

## 3. Dependency Hub — `sidebar.tsx`

**Facts:**
- `sidebar.tsx` imports from six or more UI components: `button`, `input`, `separator`, `sheet`, `skeleton`, and `tooltip`.

**Architectural Issue & Ripple Effect:**
Consequently, this creates a dependency hub where any change to the underlying UI components ripples through the sidebar. Moreover, because the sidebar is entirely unused in the feedback bot pages but is loaded by the shadcn scaffold, this unnecessary coupling inflates the dependency tree without providing functional value.

**Fix:** Remove `sidebar.tsx` or lazy-load it. It adds complexity without value for the feedback bot.

---

## 4. Dual State Management Circularity — `graph.ts` `runFeedbackStep`

**Facts:**
- `graph.ts` uses an in-memory `stateStore` Map for cross-request persistence of the rating.
- `graph.invoke` uses a `MemorySaver` checkpointer with separate `thread_ids` per step (e.g., suffixes like `-validate`, `-reask`, `-askfeedback`, `-capture`).

**Architectural Issue & State Synchronization Circularity:**
As a result, two parallel state systems are actively fighting each other. While `stateStore` persists the rating across steps, the checkpointer remains unaware of it, creating a state synchronization circular dependency. Furthermore, because each invoke call uses a different `thread_id` suffix, the `MemorySaver` never accumulates the full conversation state, rendering the checkpointer effectively broken and forcing reliance on the ad-hoc `stateStore`.

**Fix:** Remove `stateStore` Map entirely. Use a single `thread_id` per session, not per step. Remove all `thread_id` suffixes. `MemorySaver` checkpointer now handles full state. Eliminates dual state circularity. State flows through the graph as LangGraph intended.

---

## 5. Dead Dependency — `db.ts` and PrismaClient

**Facts:**
- `db.ts` defines a `PrismaClient` instance.
- The `User` and `Post` models in `schema.prisma` are completely unused.
- An SQLite database file exists, and a database connection is established.

**Architectural Issue & Unnecessary Coupling:**
However, no read or write operations occur within the feedback flow. Therefore, this constitutes a dead dependency that pointlessly increases bundle size and load times, coupling the application to a database infrastructure it never utilizes.

**Fix:** Remove `db.ts`, `schema.prisma`, the SQLite database file, and `@prisma/client` from `package.json`. Reduces bundle size and startup time.

---

## 6. Unconditional Infrastructure Loading — `layout.tsx` and Toaster

**Facts:**
- `layout.tsx` imports the `Toaster` unconditionally.
- The `Toaster` pulls in `use-toast`, which in turn imports `ToastProps` from `toast.tsx`.

**Architectural Issue & Eager Dependency Chain:**
Consequently, the full dependency chain is loaded before any page renders, blocking initial load performance. Given that only `page.tsx` and `widget/page.tsx` exist, and neither actually uses toast functionality, this eager loading creates an entirely avoidable architectural coupling.

**Fix:** Remove `Toaster` import and component from `layout.tsx`. If needed later, add Toaster per-page, not globally.

---

## 7. State Machine Architecture Contradiction — LangGraph

**Facts:**
- `graph.ts` defines a router with a pass-through function returning an empty object `{}`.
- Every node after the router points to `END`.
- `runFeedbackStep` manually sequences multiple `graph.invoke` calls.

**Architectural Issue & Conceptual Circularity:**
Thus, the graph structure and the executor pattern fundamentally contradict each other. The graph definition implies a trivial linear path (`router → node → END`), whereas the executor reality operates as a loop (`router → node → manual re-entry → router → node → END`). This pattern mismatch creates a conceptual circularity: the graph is not truly a graph, but rather a state machine driven by the external executor, defeating the purpose of the graph abstraction.

**Fix:** Remove pass-through router function. Remove all `END` edges from nodes. Add conditional edges from each node back to the appropriate next node. `askRating → validateRating → askFeedback` on valid, back to `askRating` on invalid. `askFeedback → captureAndSend → thankYou` on success. `captureAndSend` back to `askFeedback` on invalid feedback. `captureAndSend` back to `askRating` on email failure. Single invoke per full conversation, not per step. Makes the graph self-contained — no external executor looping needed.

---

## 8. Hidden State Coupling — `smtp.ts`

**Facts:**
- `smtp.ts` creates a transporter lazily using a module-level mutable state pattern (`let transporter = null`).
- `getTransporter()` checks for null and creates the instance dynamically.

**Architectural Issue & Implicit Environment Coupling:**
Although not circular, this creates hidden state coupling with the environment. Because environment variables are read at call time rather than initialization time, the module's behavior becomes unpredictable and tightly coupled to the runtime environment's state at the moment of execution.

**Fix:** Move environment variable reads to the top level. Create transporter eagerly at module load. Add validation that env vars exist at startup. Removes hidden state coupling with environment. Fails fast if misconfigured.

---

## 9. Mutable Module State — `widget.js` Embed Script

**Facts:**
- `widget.js` maintains mutable module state variables: `isOpen`, `isLoaded`, `container`, `iframe`, `toggleBtn`, and `overlay`.
- `createWidget` and `open`/`close` functions all mutate this shared state.
- Side effects are applied directly to the global `window.gemFeedback`.

**Architectural Issue & Implicit Function Coupling:**
Consequently, there is zero encapsulation. This creates implicit coupling between the `load`, `open`, and `close` functions, as they all rely on and mutate the same unguarded global state, making the execution flow dependent on hidden side effects rather than explicit data passing.

**Fix:** Create a `WidgetState` class or closure to encapsulate the widget's internal state. Expose only `load`, `open`, `close`, and `toggle` methods. Prohibit global mutable variables. Eliminates implicit function coupling.