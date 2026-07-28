# Dragon Island — Phase 1

Prototype đầu tiên của game lấy cảm hứng từ Đảo Rồng:

- Đảo isometric 14x14
- Camera kéo bằng chuột phải
- Zoom bằng con lăn chuột
- Rồng di chuyển tới ô được chọn
- Đặt Nhà chính và Nông trại
- Kiểm tra ô đã có công trình
- Không cần asset ngoài

## Yêu cầu

Vite 8 yêu cầu Node.js 20.19+ hoặc 22.12+.

Kiểm tra:

```bash
node -v
npm -v
```

## Chạy project

```bash
npm install
npm run dev
```

Sau đó mở địa chỉ Vite hiển thị trong terminal.

## Điều khiển

- Chuột trái: cho rồng di chuyển
- Chuột phải + kéo: di chuyển camera
- Lăn chuột: zoom
- Phím 1: chọn Nhà chính
- Phím 2: chọn Nông trại
- ESC: hủy chế độ xây dựng

## Mục tiêu tiếp theo của Phase 1

1. Thay texture tạm bằng sprite thật.
2. Thêm animation idle/walk cho rồng.
3. Công trình chiếm nhiều hơn một ô.
4. Hiển thị lưới khi xây dựng.
5. Cho phép chọn, di chuyển và xoá công trình.
6. Lưu bố cục đảo vào JSON/local state.
