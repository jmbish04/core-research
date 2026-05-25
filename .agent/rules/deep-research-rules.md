# Deep Research System Rules & Guardrails

## 1. Data Longevity Architecture

- Chat history displayed in standard workspace viewports MUST be loaded directly from D1 relational database storage tables (`research_messages`), rather than relying on brief in-memory Durable Object state limits.
- Ensure every transactional chat turn writes immediately to its corresponding database table row before handling downstream execution workflows.

## 2. Gemini Interactions API Protocols

- Interfacing with the Gemini Deep Research pipeline MUST exclusively execute through the interactions endpoint abstraction layers (`https://generativelanguage.googleapis.com/v1beta/interactions`) utilizing the designated 2026 revision payload identifiers (`Api-Revision: 2026-05-20`).
- Always pass configuration flags with `background: true` when scheduling lengthy evaluation threads.

## 3. Sandboxed Code Mode Execution

- Multi-step asset optimization tasks (PWA rendering, text conversion configurations) MUST execute within securely isolated V8 isolates via Cloudflare Dynamic Workers configurations using `@cloudflare/codemode` tools.
- Never directly parse untrusted string modules in your standard worker thread space using raw `eval()` statements.

## 4. Cloudflare Agents SDK Best Practices

Based on the Cloudflare documentation research:

### Long-Running Operations

- Use `keepAlive()` or `keepAliveWhile()` to prevent Durable Object eviction during long-running operations
- Durable Objects are evicted after 70-140 seconds of inactivity
- `keepAliveWhile()` wraps async functions with automatic cleanup (recommended approach)
- Multiple concurrent `keepAlive()` calls return independent disposers

### Agent vs Workflow Decision

Use **Agents** for:
- Agent-centric work: scheduling, polling, state updates
- Real-time communication via WebSockets
- Tasks under 30 seconds with keepAlive

Use **Workflows** for:
- Independent multi-step pipelines
- Tasks requiring automatic retries with backoff
- Human approval flows with `waitForApproval()`
- Tasks over 30 seconds per step

### State Management

- Use `setState()` to persist state across activations
- State is stored in the `cf_agents_state` SQL table
- Use `this.sql` template tag for executing queries against Durable Object's SQL storage
- State messages are sent with `type: "cf_agent_state"`

### Scheduling

- Use `schedule()` for one-time future execution
- Use `scheduleEvery()` for recurring tasks
- Schedules survive agent eviction and restart

## 5. Dynamic Workers Best Practices

- Always set `globalOutbound: null` in `DynamicWorkerExecutor` to block external fetch by default
- Use 30-second timeout for code execution
- Console output is automatically captured and returned
- Network isolation is enforced at the Workers runtime level

## 6. Security Considerations

- Never commit GEMINI_API_KEY or other secrets to the repository
- Use Cloudflare Secrets Store for all sensitive environment variables
- Validate all user input with Zod schemas
- Sanitize content before passing to Dynamic Workers

## 7. Performance Guidelines

- Minimize D1 database queries by batching where possible
- Use indexes for frequently queried columns
- Stream large responses instead of buffering
- Cache artifact generation results in R2

## 8. Error Handling

- Always wrap API calls in try-catch blocks
- Log errors to the logger utility for tracing
- Return meaningful error messages to clients
- Update project status to 'failed' on unrecoverable errors
