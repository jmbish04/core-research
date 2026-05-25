# Deep Research Platform Implementation

A stateful, autonomous Deep Research Platform built on Cloudflare Workers, integrating real-time chat interfaces, stateful edge multi-agent orchestration via the Cloudflare Agents SDK, and asynchronous deep context aggregation via the Gemini Interactions API.

## Architecture Overview

### Core Technology Stack

- **Routing & API**: Cloudflare Workers + Hono (OpenAPI v3.1.0 compliant via Zod validation)
- **Frontend**: Astro (SSR + Static hybrid) + React Islands + Shadcn UI
- **UI Components**: `assistant-ui` for messaging loops and custom Generative UI
- **Data & State**: Cloudflare D1 with Drizzle ORM
- **Autonomous Actions**: Cloudflare Dynamic Workers via `@cloudflare/codemode`
- **Storage**: Cloudflare R2 for binary assets

### Design System: Monolith Theme

The UI uses the borderless, absolute high-contrast dark Monolith theme with OKLCH color variables:

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --primary: oklch(0.922 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  /* ... */
}
```

## Database Schema

### Tables

1. **research_projects** - Project metadata and tracking
   - id, userId, title, status, topic, tags
   - interactionId, lastEventId (for Gemini tracking)
   - createdAt, updatedAt

2. **research_messages** - Conversation history
   - id, projectId, role, content, createdAt

3. **research_artifacts** - Generated outputs
   - id, projectId, type, title, content, publicUrl, createdAt

## API Endpoints

### Research API (`/api/research`)

- **POST /init** - Initialize a new research project
- **POST /message** - Send a message (saves to D1, gets AI response)
- **POST /dispatch** - Dispatch deep research to Gemini Interactions API
- **GET /status/:projectId** - Check Gemini interaction status
- **POST /action** - Generate artifacts (PWA, podcast, mindmap, dev_suite)
- **GET /:projectId** - Get project details with messages and artifacts
- **GET /list/:userId** - List all projects for a user

## Gemini Interactions API Integration

The platform integrates with Gemini's Deep Research API (`deep-research-preview-04-2026`):

```typescript
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Api-Revision": "2026-05-20",
    "x-goog-api-key": env.GEMINI_API_KEY,
  },
  body: JSON.stringify({
    agent: "deep-research-preview-04-2026",
    background: true,
    agent_config: {
      type: "deep-research",
      thinking_summaries: "auto",
      visualization: "auto",
    },
    prompt: query,
  }),
});
```

### Background Tracking Loop

The `ResearchAgent` Durable Object polls the Gemini API for updates:

1. Check interaction status every 5 seconds
2. Resume stream from `last_event_id` if available
3. Broadcast events to connected clients via WebSocket
4. Update D1 database when completed
5. Handle connection drops gracefully

## Artifact Generation Pipeline

### Dynamic Workers & Code Mode

Four specialized artifact generators using sandboxed execution:

1. **PWA Visualizer** - Generates responsive single-file dashboard
2. **Podcast Synthesis** - Text-to-speech via Workers AI
3. **Mindmap Generator** - Hierarchical JSON structure
4. **Dev Suite Tooling** - PRD.md, tasks.json, PROMPT.md

All use `DynamicWorkerExecutor` with network isolation (`globalOutbound: null`).

## Frontend Architecture

### Pages

- **`/research`** - Main research dashboard

### Components

- **`ResearchDashboard`** - Project management and creation
- **`ResearchChat`** - Interactive chat with assistant-ui integration

### Features

- Real-time message history from D1
- Project status tracking (draft, planning, running, completed, failed)
- Artifact generation buttons
- Responsive grid layout
- Dark theme with Monolith OKLCH colors

## Configuration

### wrangler.jsonc

```jsonc
{
  "ai": { "binding": "AI" },
  "worker_loaders": [{ "binding": "LOADER" }],
  "r2_buckets": [{ "binding": "R2", "bucket_name": "research-artifacts" }],
  "d1_databases": [{ "binding": "DB" /* ... */ }],
  "secrets_store_secrets": [{ "binding": "GEMINI_API_KEY" /* ... */ }],
}
```

### Required Secrets

- `GEMINI_API_KEY` - Google Gemini API key for Deep Research

## Setup & Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate and Apply Migrations

```bash
npm run db:generate
npm run migrate:remote
```

### 3. Configure Secrets

```bash
npx wrangler secret put GEMINI_API_KEY
```

### 4. Deploy

```bash
npm run deploy
```

## Development

```bash
npm run dev        # Start Astro dev server
npm run preview    # Preview with Wrangler
npm run build      # Build for production
```

## Cloudflare Agents SDK Integration

The implementation follows Cloudflare's best practices for long-running agents:

### Key Primitives Used

- **`setState()` / `this.sql`** - Persist state across activations
- **`schedule()`** - Wake the agent at future times
- **`keepAliveWhile()`** - Prevent eviction during active work
- **`broadcast()`** - Send state updates to connected clients

### Agent vs Workflow Decision

This implementation uses **Agents** for:

- Background polling and state updates
- Real-time WebSocket communication
- Managing research lifecycle

Could extend with **Workflows** for:

- Multi-step artifact generation pipelines
- Retry logic with backoff
- Human approval flows

## Security

- All user input validated with Zod schemas
- Dynamic Workers run in isolated V8 contexts
- Network access blocked by default (`globalOutbound: null`)
- Secrets managed via Cloudflare Secrets Store
- CORS and rate limiting via Hono middleware

## Performance Optimizations

- Message history loaded from D1 (persistent across sessions)
- Streaming responses from Gemini API
- Batch database operations where possible
- R2 storage for large binary artifacts
- Edge deployment for low latency

## Future Enhancements

1. **Real-time collaboration** - Multiple users per project
2. **Advanced artifact types** - Custom templates and generators
3. **Integration with GitHub** - Auto-create repositories for dev_suite
4. **Spotify integration** - Upload podcasts directly
5. **Workflow implementation** - Replace polling with step functions
6. **Vector search** - Semantic search across research history

## Documentation References

- [Cloudflare Agents SDK - Long-Running Agents](https://developers.cloudflare.com/agents/concepts/long-running-agents/)
- [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)
- [Cloudflare Workflows](https://developers.cloudflare.com/agents/concepts/workflows/)
- [Code Mode SDK](https://developers.cloudflare.com/agents/api-reference/codemode/)

## License

MIT
