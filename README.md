# Demo dự báo tốc độ giao thông

Ứng dụng web dùng dữ liệu mẫu để mô phỏng tình trạng giao thông và dự báo tốc độ sau 5, 10, 30 hoặc 60 phút.

- Xem mức độ ùn tắc trên bản đồ và biểu đồ tốc độ tại từng điểm đo.
- Tạo cấu hình cho các điểm đo và đoạn đường, rồi tải xuống dưới dạng `target.json`.

## Chạy thử

Mở hai terminal tại thư mục gốc của dự án. Chạy backend (NestJS) trong terminal thứ nhất.

```bash
cd backend
cp -n .env.example .env
npm ci
npm run start:dev
```

Chạy frontend (React + Vite) trong terminal thứ hai.

```bash
cd frontend
cp -n .env.example .env
npm ci
npm run dev
```

Mở [localhost:5173](http://localhost:5173) để xem demo. API mặc định chạy ở cổng `3000`.

## Chạy bằng Docker Compose

Từ thư mục gốc, chạy các lệnh sau để build và khởi động một container chứa cả NestJS và bản build React.

```bash
cp -n backend/.env.example backend/.env
docker compose up --build
```

Mở [localhost:3000](http://localhost:3000) để xem trang chủ. API dùng cùng cổng với tiền tố `/api`.
Nếu cổng `3000` đang bận, chạy `FEDTRAFFIC_PORT=3001 docker compose up --build` và mở [localhost:3001](http://localhost:3001).
