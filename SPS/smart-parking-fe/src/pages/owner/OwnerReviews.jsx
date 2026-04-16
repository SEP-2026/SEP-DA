import { useEffect, useState } from "react";
import { formatDateTime, SectionCard } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";

export default function OwnerReviews() {
  const { ownerData } = useOwnerContext();
  const [replies, setReplies] = useState(() => Object.fromEntries(ownerData.reviews.map((item) => [item.id, item.reply || ""])));
  const [savedId, setSavedId] = useState("");

  useEffect(() => {
    setReplies(Object.fromEntries(ownerData.reviews.map((item) => [item.id, item.reply || ""])));
  }, [ownerData.reviews]);

  return (
    <div className="owner-page-grid">
      <SectionCard title="Đánh giá từ người dùng" subtitle="Owner chỉ xem và phản hồi các đánh giá của bãi mình quản lý.">
        <div className="owner-reviews">
          {ownerData.reviews.map((review) => (
            <article key={review.id} className="owner-review-card">
              <div className="owner-review-head">
                <div>
                  <strong>{review.user}</strong>
                  <span>{formatDateTime(review.createdAt)}</span>
                </div>
                <div className="owner-review-rating">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              </div>
              <p className="owner-review-content">{review.content}</p>
              <label className="owner-review-reply">
                Phản hồi của bãi
                <textarea
                  className="owner-input owner-textarea"
                  rows="3"
                  value={replies[review.id] || ""}
                  onChange={(event) => {
                    setSavedId("");
                    setReplies((prev) => ({ ...prev, [review.id]: event.target.value }));
                  }}
                  placeholder="Nhập phản hồi cho khách hàng"
                />
              </label>
              <div className="owner-review-actions">
                {savedId === review.id ? <p className="owner-save-note">Đã lưu phản hồi.</p> : <span />}
                <button type="button" className="btn-primary owner-btn owner-btn--small" onClick={() => setSavedId(review.id)}>
                  Gửi phản hồi
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
