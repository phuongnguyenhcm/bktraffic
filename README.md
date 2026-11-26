# BKTraffic — Traffic Forecasting & Edge Node Management

A web application for monitoring urban traffic conditions, ingesting speed predictions from distributed **Edge Agents**, and forecasting road speeds across multiple time horizons (`5`, `10`, `30`, or `60` minutes).

## Features

- **Interactive Traffic Map:** Renders individual road segments (`polyline`) and real-time congestion states (`CLEAR`, `MODERATE`, `CONGESTED`, `UNKNOWN`) independently without waiting for adjacent nodes.
- **Node Inspection & History:** View historical speed charts and fixed-horizon forecasts for any monitored road segment.
- **Edge Node Setup & Topology Builder:** Configure sensor networks, auto-resolve road segment geometries via TomTom Flow Segment, and export `target.json` configurations for Edge Agents.
- **Local Persistence & Geometry Caching:** Stores forecast data, registered agents, and resolved road polylines (`polyline_caches`) in a local MongoDB instance.

---

## Running
```bash
docker compose up -d --build
```

---