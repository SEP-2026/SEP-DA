import { useEffect, useState } from "react";
import { formatDateTime, SectionCard } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";
import API from "../../services/api";

export default function OwnerReviews() {
  const { ownerData, actions } = useOwnerContext();
  const [reviews, setReviews] = useState(ownerData.reviews);
  const [replies, setReplies] = useState(() => Object.fromEntries(ownerData.reviews.map((item) => [item.id, item.reply || ""])));
  const [savedId, setSavedId] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await API.get("/owner/reviews");
        const nextReviews = res.data?.reviews || [];
        setReviews(nextReviews);
        setReplies(Object.fromEntries(nextReviews.map((item) => [item.id, item.reply || ""])));
      } catch {
        setReviews(ownerData.reviews);
        setReplies(Object.fromEntries(ownerData.reviews.map((item) => [item.id, item.reply || ""])));
      }
    };
    fetchReviews();
  }, [ownerData.reviews]);

  return (
    <div className="owner-page-grid">
      <SectionCard title="Đánh giá từ người dùng" subtitle="Owner chỉ xem và phản hồi các đánh giá của bãi mình quản lý.">
        <div className="owner-reviews">
          {reviews.map((review) => (
            <article key={review.id} className="owner-review-card">
              <div className="owner-review-head">
                <div>
                  <strong>{review.user}</strong>
                  <span>{formatDateTime(review.createdAt)}</span>
                </div>
                <div className="owner-review-rating">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              </div>
              <p className="owner-review-content"><strong>{review.parkingLotName}</strong></p>
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
                <button
                  type="button"
                  className="btn-primary owner-btn owner-btn--small"
                  disabled={savingId === review.id}
                  onClick={async () => {
                    setSavingId(review.id);
                    const ok = await actions.updateReviewReply(review.id, replies[review.id] || "");
                    if (ok) {
                      setSavedId(review.id);
                      setReviews((prev) => prev.map((item) => (item.id === review.id ? { ...item, reply: replies[review.id] || "" } : item)));
                    }
                    setSavingId("");
                  }}
                >
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
