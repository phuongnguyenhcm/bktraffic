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

Từ thư mục gốc, chạy các lệnh sau để khởi động ứng dụng NestJS/React và MongoDB cục bộ. MongoDB lưu dữ liệu và cache hình học trong volume `mongo_data`.

```bash
cp -n .env.example .env
docker compose up --build
```

Mở [localhost:3000](http://localhost:3000) để xem trang chủ. API dùng cùng cổng với tiền tố `/api`.
Nếu cổng `3000` đang bận, chạy `PORT=3001 docker compose up --build` và mở [localhost:3001](http://localhost:3001).

Đặt `MONGODB_URI=mongodb://mongo:27017/traffic_db` trong tệp `.env` của Compose. Khi chạy backend trực tiếp trên máy, dùng `mongodb://localhost:27017/traffic_db` với cổng MongoDB mặc định.

Trên máy chủ, có thể dùng `ENV_FILE=/etc/bktraffic/.env docker compose --env-file /etc/bktraffic/.env up --build`.
