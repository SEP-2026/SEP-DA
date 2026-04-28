# Changelog

## [Unreleased] - 2026-04-28

### Added
- Auto-cancel bookings marked as `booked` when elapsed time since `start_time` >= 30% of booking duration (no-show). Implemented in `app/services/auto_checkout_service.py`.
- Test script `scripts/run_auto_cancel_test.py` to validate auto-cancel behavior (includes SQLite fallback for local runs).
- Simple bell notification panel in the frontend to store and show overdue booking notifications.
- New payment history page with booking amount, paid amount, and 30% deposit display for no-show bookings.

### Notes
- No automatic refunds implemented; payment handling left unchanged.
- Threshold is currently hard-coded to 30% but can be refactored to a config variable if desired.
