import csv
import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# --- Cấu hình ---
API_BASE = "https://bktraffic.phng-hcmut.xyz"
AGENT_ID = "agent-q10-bk"
AGENT_NAME = "Edge Agent ĐH Bách Khoa"
AGENT_REGION = "Quận 10, TP.HCM"
DATA_DIR = Path(".")
HISTORY_STEPS = 10  # Số mốc lịch sử đẩy lên để vẽ biểu đồ trên Dashboard


def post_json(path: str, payload: dict) -> dict:
    url = f"{API_BASE.rstrip('/')}{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"POST {path} -> HTTP {e.code}: {detail}") from e


def speed_to_status(ratio: float) -> str:
    if ratio >= 0.75:
        return "CLEAR"
    if ratio >= 0.45:
        return "MODERATE"
    return "CONGESTED"


def register_agent() -> None:
    target = json.loads((DATA_DIR / "target.json").read_text(encoding="utf-8"))
    payload = {
        "agentId": AGENT_ID,
        "name": AGENT_NAME,
        "region": AGENT_REGION,
        "nodes": target["nodes"],
        "connections": target["connections"],
    }
    res = post_json("/api/edge-agents/register", payload)
    print(f"[OK] Đã đăng ký Agent '{AGENT_ID}': {len(target['nodes'])} nodes, {len(target['connections'])} connections")
    if res:
        print("     Response:", res)


def load_node_map() -> dict[int, str]:
    with (DATA_DIR / "direction_info.csv").open(encoding="utf-8") as f:
        return {int(row["index"]): row["direction"] for row in csv.DictReader(f)}


def push_predictions() -> None:
    node_map = load_node_map()

    # Gom các dòng speed.csv theo từng mốc thời gian
    by_node: dict[int, list[dict]] = {idx: [] for idx in node_map}
    with (DATA_DIR / "speed.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            idx = int(row["direction_index"])
            if idx in by_node:
                by_node[idx].append(row)

    now = datetime.now(timezone.utc)
    pushed = 0

    for idx, rows in by_node.items():
        node_name = node_map[idx]
        recent = rows[-HISTORY_STEPS:]
        total = len(recent)

        for i, row in enumerate(recent):
            ratio = round(float(row["speed_ratio"]), 4)
            conf = round(float(row["confidence"]), 4)
            # Dời mốc thời gian về gần hiện tại (cách nhau 5 phút) để không bị TTL 15 phút xóa
            observed_at = now - timedelta(minutes=5 * (total - 1 - i))

            # Lấy giá trị tương lai gần trong file làm dự báo (hoặc giữ nguyên nếu ở cuối file)
            forecasts = []
            for horizon, offset in [(5, 1), (10, 2), (30, 6), (60, 12)]:
                future_idx = min(i + offset, total - 1)
                pred_ratio = round(float(recent[future_idx]["speed_ratio"]), 4)
                forecasts.append({
                    "horizonMinutes": horizon,
                    "predictedSpeedRatio": pred_ratio,
                    "status": speed_to_status(pred_ratio),
                })

            payload = {
                "edgeAgentId": AGENT_ID,
                "nodeId": node_name,
                "currentSpeedRatio": ratio,
                "confidence": conf,
                "observedAt": observed_at.isoformat().replace("+00:00", "Z"),
                "forecasts": forecasts,
            }
            post_json("/api/edge-nodes/predictions", payload)
            pushed += 1

    print(f"[OK] Đã đẩy {pushed} bản ghi dự báo cho {len(node_map)} nodes.")


if __name__ == "__main__":
    register_agent()
    push_predictions()