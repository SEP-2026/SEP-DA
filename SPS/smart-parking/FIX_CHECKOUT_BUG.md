# Bug Fix: Checkout không trừ phần còn lại

## Vấn đề
- User nạp 50.100.000đ
- Booking 130.000đ (trừ 39.000đ ngay = 30%)
- Khi checkout, vẫn không trừ phần còn lại (91.000đ)

## Root Cause Analysis

### Current Logic in `check_out`:
```python
reserved_amount = round(float(booking.total_amount or 0) * 0.3, 2)  # 39.000
remaining_amount = round(float(booking.total_amount or 0) - reserved_amount + overtime_fee, 2)  # 91.000

settle_booking_payment(
    reserved_amount=reserved_amount,  # 39.000
    capture_amount=remaining_amount,  # 91.000
)
```

### Problem 1: Wallet Balance Check
Khi `settle_booking_payment` được gọi:
- Kiểm tra: `if current_balance < capture_due (91.000)`
- **NẾU user đã dùng tiền ở chỗ khác, balance có thể không đủ**
- Sẽ raise `InsufficientWalletBalance` exception
- Exception được catch nhưng không log, user chỉ thấy lỗi mà không biết lý do

### Problem 2: Check-in Status Validation
```python
if booking.status != "checked_in":
    raise HTTPException(status_code=400, detail="Chưa check-in")
```
- Nếu user không thực sự check-in (chỉ booking -> directly checkout), sẽ fail

## Giải pháp
1. **Thêm error logging** để biết chính xác lỗi gì
2. **Kiểm tra flow check-in/checkout** 
3. **Fix: Cho phép checkout từ trạng thái "booked"** (nếu user không check-in)
4. **Kiểm tra wallet balance** trước khi checkout
