import { useEffect, useState } from "react";
import { SectionCard } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";
import { isStrongPassword, PASSWORD_POLICY_TEXT } from "../../services/passwordPolicy";

export default function OwnerSettings() {
  const { auth, ownerData, actions } = useOwnerContext();
  const [parkingForm, setParkingForm] = useState(ownerData.settings);
  const [accountForm, setAccountForm] = useState({
    email: auth?.user?.email || "",
    password: "",
    confirmPassword: "",
  });
  const [parkingSaved, setParkingSaved] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);

  useEffect(() => {
    setParkingForm(ownerData.settings);
  }, [ownerData.settings]);

  useEffect(() => {
    setAccountForm((prev) => ({
      ...prev,
      email: auth?.user?.email || "",
    }));
  }, [auth?.user?.email]);

  const handleParkingChange = (key, value) => {
    setParkingSaved(false);
    setParkingForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleParkingSubmit = async (event) => {
    event.preventDefault();
    const ok = await actions.updateSettings(parkingForm);
    if (ok) {
      setParkingSaved(true);
    }
  };

  return (
    <div className="owner-page-grid">
      <SectionCard title="Tài khoản Owner" subtitle="Tài khoản này do admin cấp. Owner có thể thay đổi email và mật khẩu sau khi đăng nhập.">
        <form
          className="owner-settings-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (accountForm.password || accountForm.confirmPassword) {
              if (!isStrongPassword(accountForm.password)) {
                window.alert(PASSWORD_POLICY_TEXT);
                return;
              }
            }
            const ok = await actions.updateAccount(accountForm);
            if (ok) {
              setAccountSaved(true);
              setAccountForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
            }
          }}
        >
          <label>
            Email đăng nhập
            <input className="owner-input" value={accountForm.email} onChange={(event) => {
              setAccountSaved(false);
              setAccountForm((prev) => ({ ...prev, email: event.target.value }));
            }} />
          </label>
          <label>
            Mật khẩu mới
            <input className="owner-input" type="password" minLength={8} value={accountForm.password} onChange={(event) => {
              setAccountSaved(false);
              setAccountForm((prev) => ({ ...prev, password: event.target.value }));
            }} />
          </label>
          <label>
            Nhập lại mật khẩu
            <input className="owner-input" type="password" minLength={8} value={accountForm.confirmPassword} onChange={(event) => {
              setAccountSaved(false);
              setAccountForm((prev) => ({ ...prev, confirmPassword: event.target.value }));
            }} />
          </label>
          <p className="owner-save-note owner-form-span">{PASSWORD_POLICY_TEXT}</p>
          <div className="owner-settings-actions owner-form-span">
            {accountSaved ? <p className="owner-save-note">Đã lưu thông tin tài khoản.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Cập nhật tài khoản</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Thiết lập bãi đỗ" subtitle="Điều chỉnh giá gửi xe, số lượng vị trí và thông tin liên hệ của bãi.">
        <form className="owner-settings-form" onSubmit={async (event) => {
          await handleParkingSubmit(event);
        }}>
          <label>
            Tên bãi đỗ
            <input className="owner-input" value={parkingForm.parkingName} onChange={(event) => handleParkingChange("parkingName", event.target.value)} />
          </label>
          <label>
            Số lượng vị trí
            <input className="owner-input" value={parkingForm.slotCapacity} onChange={(event) => handleParkingChange("slotCapacity", event.target.value)} />
          </label>
          <label>
            Giá theo giờ (VND)
            <input className="owner-input" value={parkingForm.pricePerHour} onChange={(event) => handleParkingChange("pricePerHour", event.target.value)} />
          </label>
          <label>
            Giá theo ngày (VND)
            <input className="owner-input" value={parkingForm.pricePerDay} onChange={(event) => handleParkingChange("pricePerDay", event.target.value)} />
          </label>
          <label>
            Giá theo tháng (VND)
            <input className="owner-input" value={parkingForm.pricePerMonth} onChange={(event) => handleParkingChange("pricePerMonth", event.target.value)} />
          </label>
          <label>
            Khung giờ cao điểm
            <input className="owner-input" value={parkingForm.peakHours} onChange={(event) => handleParkingChange("peakHours", event.target.value)} />
          </label>
          <label>
            Phụ thu giờ cao điểm (%)
            <input className="owner-input" value={parkingForm.peakSurcharge} onChange={(event) => handleParkingChange("peakSurcharge", event.target.value)} />
          </label>
          <label>
            Tên đơn vị liên hệ
            <input className="owner-input" value={parkingForm.contactName} onChange={(event) => handleParkingChange("contactName", event.target.value)} />
          </label>
          <label>
            Số điện thoại
            <input className="owner-input" value={parkingForm.contactPhone} onChange={(event) => handleParkingChange("contactPhone", event.target.value)} />
          </label>
          <label>
            Email liên hệ
            <input className="owner-input" value={parkingForm.contactEmail} onChange={(event) => handleParkingChange("contactEmail", event.target.value)} />
          </label>
          <label className="owner-form-span">
            Quy định bãi đỗ
            <textarea className="owner-input owner-textarea" rows="5" value={parkingForm.regulations} onChange={(event) => handleParkingChange("regulations", event.target.value)} />
          </label>
          <div className="owner-settings-actions owner-form-span">
            {parkingSaved ? <p className="owner-save-note">Đã cập nhật cấu hình bãi đỗ.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Lưu cài đặt bãi</button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
