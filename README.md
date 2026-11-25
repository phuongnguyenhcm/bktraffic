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

## Chạy bằng Docker

Từ thư mục gốc, build một image chứa cả NestJS và bản build React.

```bash
docker build -f backend/Dockerfile -t fedtraffic-backend .
docker run --rm --env-file backend/.env.example -p 127.0.0.1:3000:3000 fedtraffic-backend
```

Mở [localhost:3000](http://localhost:3000) để xem trang chủ. API dùng cùng cổng với tiền tố `/api`.
