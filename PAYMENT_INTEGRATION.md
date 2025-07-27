# Payment Integration Documentation

## Overview
Sistem pembayaran menggunakan Midtrans untuk memproses transaksi dan otomatis mengubah status order ketika payment berhasil.

## Endpoints

### 1. Create Payment
- **Endpoint**: `POST /payment`
- **Body**:
```json
{
  "orderId": "ORDER_ID",
  "amount": 50000,
  "customerDetails": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "081234567890"
  }
}
```

### 2. Check Payment Status
- **Endpoint**: `GET /payment/:orderId/status`
- **Description**: Mengecek status payment dan otomatis update status order jika diperlukan

### 3. Cancel Payment
- **Endpoint**: `DELETE /payment/:orderId`
- **Description**: Membatalkan transaksi payment

### 4. Webhook Notification (Midtrans)
- **Endpoint**: `POST /payment/notification`
- **Description**: Endpoint untuk menerima notification dari Midtrans ketika status payment berubah
- **Note**: Endpoint ini harus didaftarkan di Midtrans Dashboard sebagai Notification URL

### 5. Sync Payment Status
- **Endpoint**: `POST /payment/:orderId/sync`
- **Description**: Manual sync untuk memeriksa dan menyinkronkan status payment dengan order status

## Flow Pembayaran

### 1. Normal Flow
1. User membuat order → status: `PENDING`
2. User melakukan pembayaran melalui Midtrans
3. Midtrans mengirim notification ke webhook
4. System otomatis mengubah status order:
   - Payment berhasil (`settlement`/`capture`) → `IN_PROGRESS`
   - Payment gagal (`cancel`/`deny`/`expire`) → `CANCELLED`

### 2. Manual Check Flow
1. Jika webhook tidak diterima, gunakan endpoint `/payment/:orderId/sync`
2. System akan mengecek status terbaru dari Midtrans
3. Update status order sesuai dengan status payment

## Status Mapping

| Payment Status | Order Status | Description |
|---------------|-------------|-------------|
| `settlement` | `IN_PROGRESS` | Payment berhasil |
| `capture` | `IN_PROGRESS` | Payment berhasil (kartu kredit) |
| `pending` | `PENDING` | Payment masih pending |
| `cancel` | `CANCELLED` | Payment dibatalkan |
| `deny` | `CANCELLED` | Payment ditolak |
| `expire` | `CANCELLED` | Payment expired |

## Environment Variables Required

```env
SERVER_KEY=your_midtrans_server_key
FRONT_END_URL=your_frontend_url
```

## Fraud Detection
System akan mengecek `fraud_status` dari Midtrans:
- Jika `fraud_status` adalah `accept` atau kosong, payment dianggap valid
- Jika `fraud_status` adalah `challenge` atau `deny`, payment tidak akan mengubah status order

## Error Handling
- Semua error akan di-log untuk debugging
- Webhook notification akan tetap mengembalikan status 200 untuk menghindari retry dari Midtrans
- Manual sync endpoint akan mengembalikan error detail jika ada masalah

## Testing
Untuk testing di development environment:
1. Gunakan Midtrans sandbox
2. Set `isProduction: false` di payment controller
3. Gunakan test cards yang disediakan Midtrans
4. Test webhook menggunakan ngrok atau similar tools untuk expose local server

## Notes
- Webhook notification harus dapat diakses dari internet (untuk production)
- Pastikan endpoint `/payment/notification` tidak memerlukan authentication
- System akan otomatis mengurangi stok menu ketika order status berubah ke `IN_PROGRESS`
