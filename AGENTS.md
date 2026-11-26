# AGENTS.md

## Project Overview — BKTraffic

**BKTraffic** is a Traffic Forecasting & Edge Management web application.
- **Backend:** NestJS (ESM, Vitest, MongoDB via `@nestjs/mongoose`). In production, NestJS serves the pre-compiled React static assets (`frontend/dist`).
- **Frontend:** React + Vite + Tailwind CSS + `shadcn/ui`.
- **Environment & Secrets:** NEVER hardcode API keys, database URIs, or credentials in source files. Always isolate them in `.env` (loaded via `@nestjs/config` / `dotenv`) and never commit `.env` to Git.

---

## Scaffolding & Tooling Rules

- **Official CLIs Only:** Always initialize projects, modules, and UI components using official CLIs (`npx @nestjs/cli`, `npm create vite`, `npx shadcn@latest init`) rather than manual boilerplate scaffolding.
- **UI Primitives:** Use `shadcn/ui` components (`frontend/src/components/ui/`) for all standard UI elements.

---

## Frontend UI/UX Standards

- **Bilingual Support (VI / EN):** All user-facing strings must be defined in both `frontend/src/i18n/vi.ts` and `frontend/src/i18n/en.ts` and accessed via `useLanguage()`. Do not hardcode display text in components.
- **Theming:** Support both **Light** and **Dark** themes using semantic CSS tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.).
- **Layout Consistency:** Maintain consistent outer padding and spacing across all primary pages (`landing-page`, `dashboard-page`, `edge-nodes-page`, `edge-setup-page`).

---

## Traffic Forecast Architecture Rules (Model-Agnostic)

1. **No Hardcoded Model Assumptions:**
   - NEVER assume a fixed forecast interval (e.g., 5 min) or fixed sequence length (e.g., 12 frames).
   - Ingestion APIs must accept an arbitrary-length sequence of forecast frames where each frame explicitly carries `targetTimestamp` (ISO-8601 / `Date`) alongside the batch's `generatedAt`.

2. **Spatial & Temporal Bucketing (Decoupled Strategy):**
   - NEVER embed timestamp matching, bucketing, or coordinate hashing directly inside controllers or raw MongoDB queries.
   - Isolate all bucketing and time-matching rules in a dedicated, injectable service (e.g., `ForecastTimeMatcherService` / `ForecastBucketingService`) configurable via environment variables:
     - **Spatial Key (`spatialKey`):** Encode `(lat, lng)` into a **Geohash** string with configurable precision (`FORECAST_GEOHASH_PRECISION`, default `7` or `8`). If a node has no coordinates, fall back to `nodeId`.
     - **Temporal Bucket (`timeBucket`):** Quantize `targetTimestamp` into discrete time buckets using `FORECAST_TIME_BUCKET_MS` (e.g., `Math.floor(timestampMs / bucketMs) * bucketMs`).
     - **Query Resolution:** Given a `requestedTime` (e.g., `now + horizon`), the matcher resolves the target `timeBucket` (or window of buckets within `FORECAST_MATCH_WINDOW_MS`).

3. **Duplicate Handling (Write vs. Read):**
   - **Temporal deduplication (same agent, same location, same time bucket):** Enforce a unique compound index on `{ agentId: 1, spatialKey: 1, timeBucket: 1 }`. On ingestion, use MongoDB `bulkWrite` (`updateOne` + `upsert: true`) and only overwrite if incoming `generatedAt` is newer than or equal to the stored record.
   - **Spatial aggregation (multiple agents covering the same area):** At query time, filter by the resolved `timeBucket` window, `$group` by `spatialKey`, and compute the **mean** (`$avg`) of numeric predictions (e.g., `predictedSpeed`), then derive the categorical traffic status (`CLEAR` / `MODERATE` / `CONGESTED`) from the averaged value.
   - **Response Metadata:** Always return the actual matched `targetTimestamp` / `timeBucket` and `latestGeneratedAt` so the frontend can display exact times and detect stale data.
   
---

## Git Branching & Docker Release Workflow

- **`dev` branch:** Active development containing full `backend/` and `frontend/` source code.
- **`release/v1.0` branch:** Production release package with NestJS source at the repository root and pre-compiled React static assets in `frontend/dist/`.
- **Docker:** `compose.yaml` starts `bktraffic-app` after `mongo` is healthy. The multi-stage `backend/Dockerfile` serves the React build from `/app/frontend/dist/`. The app loads `${ENV_FILE:-.env}`.
- **MongoDB:** Set `MONGODB_URI=mongodb://mongo:27017/traffic_db` in the Compose env file, or `mongodb://localhost:27017/traffic_db` for a backend running on the host with the default MongoDB port. The `mongo_data` volume stores the database, including the `polyline_caches` collection.

---

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

A route handler can return a web `Response`, a `ReadableStream` or an async generator, and Nest streams it as it's produced (https://docs.nestjs.com/http/streaming-responses.md).

Nest's packages are ESM only, and this project is ESM too: relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), and tests run on Vitest, so mocks are `vi.fn()`, not `jest.fn()`.

In this project, `src/main.ts` creates the app and listens on `PORT` (3000 by default), `src/app.module.ts` is the root module that imports the others, and `AppController` and `AppService` are samples. Unit tests sit beside the code as `*.spec.ts` and the e2e test is in `test/`; Vitest runs them (`npm test`, `npm run test:e2e`).

When a task says how to test, follow it. When it says nothing, cover the behaviour you change with focused tests rather than adding broad e2e suites.

## Production data: NestJS Observe

This app's production telemetry - traces, errors, logs and metrics - goes to [NestJS Observe](https://observe.nestjs.com). Until `ObserveModule` is registered in `src/app.module.ts`, nothing is sent: `npx @nestjs/observe link` sets it up in one step - it installs `@nestjs/observe`, wires it into the app, and writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) to `.env`.

---

## Traffic Graph & Map Visualization Standards (Dual Graph / Line Graph)

1. **Semantic Definition of Nodes vs. Edges:**
   - **Nodes = Physical Road Segments:** Each node represents a monitored road segment/sensor location and owns an independent `polyline` geometry (`[lat, lon][]`), speed metrics, and categorical traffic status (`CLEAR` / `MODERATE` / `CONGESTED` / `UNKNOWN`).
   - **Edges = Logical Connectivity / Transitions:** Edges (`connections`) represent topological adjacency or turn transitions between road segments (for GNN spatial message passing and routing), NOT physical road geometry.

2. **Frontend Map Rendering Rules:**
   - **Primary Traffic Layer (`node.polyline`):** Always render physical road polylines directly from `nodes` and color each segment independently using its own `node.status`. A segment with valid forecast data must immediately render in its status color without waiting for adjacent nodes to report data.
   - **Node Centroid Markers:** Render compact interactive markers/anchors at `(node.lat, node.lon)` for inspecting node history/details rather than oversized circles covering intersections.
   - **Connectivity Layer (`edges`):** Treat `edges` as a secondary topological overlay (e.g., subtle dashed connector lines or directional arrows toggleable by the user), NOT as the primary traffic status layer.

3. **Edge Status Fallback & Geometry Resolution:**
   - When registering agents with `geometry_mode = "auto"` (or when a node lacks a manual `polyline`), resolve the road segment `polyline` via TomTom Flow Segment so `GET /api/traffic/map` always returns renderable polylines for nodes.
   - For `edges` metadata: if both endpoint nodes have forecasts, compute average speed and minimum confidence; if only one endpoint has a forecast, optionally inherit or mark edge connectivity clearly without blocking the active node's own `polyline` from rendering.
