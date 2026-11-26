# BKTraffic — Traffic Forecasting & Edge Management (`release/v1.0`)

Production-ready release package for the **BKTraffic** web application. Built with **NestJS** serving the pre-compiled **React** frontend (`frontend/dist`) and backed by **MongoDB Atlas**.

## Features

- **Traffic Forecasting Dashboard:** Interactive map with real-time status (`Clear`, `Moderate`, `Congested`) and multi-horizon forecasts (`5`, `10`, `30`, `60 min`).
- **Edge Node Management:** Register, monitor (`ONLINE` / `OFFLINE`), and deploy Edge Agents via a guided setup wizard (Map Auto-Picker & Manual Polyline Upload).
- **UI/UX:** Bilingual interface (**Vietnamese / English**) and **Light / Dark** theme support.

## Project Structure

```text
.
├── src/                # NestJS backend source
├── frontend/dist/      # Pre-built React static assets
├── Dockerfile          # Multi-stage production build
├── docker-compose.yml  # Container orchestration
└── .env                # Environment variables (not committed)
```

## Quick Start (Docker)

### 1. Clone the release branch

```bash
git clone -b release/v1.0 <YOUR_REPO_URL>
cd <PROJECT_DIR>
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
TOMTOM_API_KEY=<your_tomtom_api_key>
```

### 3. Build and run

```bash
docker compose up -d --build
```

The application will be available at `http://localhost:3000`.

## Useful Commands

```bash
# View container logs
docker compose logs -f

# Stop and remove containers
docker compose down
```