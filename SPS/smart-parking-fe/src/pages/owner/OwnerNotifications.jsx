import { useEffect, useMemo, useState } from "react";
import { useOwnerContext } from "../../owner/useOwnerContext";
import { SectionCard, formatDateTime } from "../../owner/OwnerUI";
import "./OwnerNotifications.css";

const NOTIFICATION_TYPES = {
  booking: { label: "Đặt chỗ", color: "#0e7f96", icon: "📋" },
  review: { label: "Đánh giá", color: "#1c9a95", icon: "⭐" },
  payment: { label: "Thanh toán", color: "#0ca07f", icon: "💳" },
  system: { label: "Hệ thống", color: "#5d7d97", icon: "⚙️" },
  alert: { label: "Cảnh báo", color: "#c73f4c", icon: "⚠️" },
};

const STORAGE_KEY = "owner_read_notifications";

export default function OwnerNotifications() {
  const { ownerData } = useOwnerContext();
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  
  // Initialize from localStorage
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save to localStorage whenever readNotificationIds changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readNotificationIds)));
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new CustomEvent("owner_notifications_updated", { detail: { readIds: readNotificationIds } }));
  }, [readNotificationIds]);

  // Combine and categorize notifications
  const allNotifications = useMemo(() => {
    const notifications = [];

    // Booking notifications
    const recentBookings = (ownerData.bookings || []).slice(0, 5);
    recentBookings.forEach((booking) => {
      if (booking.status === "pending") {
        notifications.push({
          id: `booking-pending-${booking.id}`,
          type: "booking",
          title: "Booking mới cần xác nhận",
          message: `${booking.code} - ${booking.plate} - ${booking.slotCode}`,
          time: booking.startTime,
          status: "pending",
          priority: "high",
          action: { label: "Xem chi tiết", link: "/owner/bookings" },
        });
      } else if (booking.status === "confirmed") {
        notifications.push({
          id: `booking-confirmed-${booking.id}`,
          type: "booking",
          title: "Booking đã xác nhận",
          message: `${booking.code} - ${booking.plate}`,
          time: booking.startTime,
          status: "confirmed",
          priority: "normal",
        });
      }
    });

    // Review notifications
    const unrepliedReviews = (ownerData.reviews || []).filter((r) => !r.ownerReply).slice(0, 3);
    unrepliedReviews.forEach((review) => {
      notifications.push({
        id: `review-unreplied-${review.id}`,
        type: "review",
        title: `Đánh giá ${review.rating}/5 chưa phản hồi`,
        message: review.comment || "Khách hàng đã để lại đánh giá",
        time: review.createdAt,
        status: "unreplied",
        priority: "normal",
        action: { label: "Phản hồi", link: "/owner/reviews" },
      });
    });

    // Activity-based notifications
    const activities = (ownerData.activities || []).slice(0, 5);
    activities.forEach((activity) => {
      const typeMap = {
        warning: "alert",
        booking: "booking",
        review: "review",
        payment: "payment",
      };
      notifications.push({
        id: activity.id,
        type: typeMap[activity.type] || "system",
        title: activity.title,
        message: activity.message || "",
        time: activity.time,
        status: activity.type,
        priority: activity.type === "warning" ? "high" : "normal",
      });
    });

    // Sort by newest
    return notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [ownerData]);

  // Add isRead property to notifications
  const notificationsWithReadStatus = useMemo(() => {
    return allNotifications.map((n) => ({
      ...n,
      isRead: readNotificationIds.has(n.id),
    }));
  }, [allNotifications, readNotificationIds]);

  const filteredNotifications = useMemo(() => {
    let filtered = notificationsWithReadStatus;
    if (filterType !== "all") {
      filtered = filtered.filter((n) => n.type === filterType);
    }
    if (sortBy === "oldest") {
      filtered = [...filtered].reverse();
    }
    return filtered;
  }, [notificationsWithReadStatus, filterType, sortBy]);

  const unreadCount = notificationsWithReadStatus.filter((n) => !n.isRead).length;

  const handleNotificationHover = (notificationId) => {
    setReadNotificationIds((prev) => new Set([...prev, notificationId]));
  };

  return (
    <div className="owner-page-grid">
      <SectionCard
        title="Thông báo & Cảnh báo"
        subtitle="Theo dõi tất cả các sự kiện, booking, đánh giá và hệ thống."
        actions={
          <div className="notification-controls">
            <select
              className="owner-input owner-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tất cả loại</option>
              {Object.entries(NOTIFICATION_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.icon} {val.label}
                </option>
              ))}
            </select>
            <select
              className="owner-input owner-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>
        }
      >
        {filteredNotifications.length === 0 ? (
          <div className="owner-empty">Không có thông báo nào.</div>
        ) : (
          <div className="notification-list">
            {filteredNotifications.map((notif) => {
              const typeInfo = NOTIFICATION_TYPES[notif.type] || NOTIFICATION_TYPES.system;
              return (
                <div
                  key={notif.id}
                  className={`notification-item notification-item--${notif.priority} ${!notif.isRead ? "notification-item--unread" : ""}`}
                  onMouseEnter={() => handleNotificationHover(notif.id)}
                >
                  <div className="notification-content">
                    <h4>{notif.title}</h4>
                    {notif.message && <p>{notif.message}</p>}
                    <span className="notification-time">{formatDateTime(notif.time)}</span>
                  </div>
                  <div className="notification-badge">
                    <span className={`owner-badge owner-badge--${notif.type}`}>
                      {typeInfo.label}
                    </span>
                  </div>
                  {notif.action && (
                    <a href={notif.action.link} className="notification-action">
                      {notif.action.label} →
                    </a>
                  )}
                  <div className="notification-icon">{typeInfo.icon}</div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="notification-summary">
        <div className="notification-summary-item">
          <span className="notification-summary-value">{unreadCount}</span>
          <span className="notification-summary-label">Chưa đọc</span>
        </div>
        <div className="notification-summary-item">
          <span className="notification-summary-value">{filteredNotifications.length}</span>
          <span className="notification-summary-label">Thông báo hiển thị</span>
        </div>
        <div className="notification-summary-item">
          <span className="notification-summary-value">{notificationsWithReadStatus.length}</span>
          <span className="notification-summary-label">Tổng cộng</span>
        </div>
      </div>
    </div>
  );
}
