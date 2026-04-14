Payment QR static file location

Put your bank transfer QR image at:
- public/payment/merchant-qr.png

Dynamic VietQR (auto amount) configuration:
- VITE_VIETQR_BANK_ID=mbbank
- VITE_VIETQR_ACCOUNT_NO=<your_account_number>
- VITE_VIETQR_ACCOUNT_NAME=<your_account_name>

When these env vars are set, Payment page will show VietQR image with exact amount and booking code.
If env is missing, app falls back to static image above.

Notes:
- Keep filename exactly: merchant-qr.png
- Recommended image size: 768x768 or larger
- Replace this file anytime to update QR globally
- After replacing, hard refresh browser (Ctrl+F5)
