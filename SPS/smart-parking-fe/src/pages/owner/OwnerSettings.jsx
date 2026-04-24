import { useEffect, useState } from "react";
import { SectionCard } from "../../owner/OwnerUI";
import { useOwnerContext } from "../../owner/useOwnerContext";
import { isStrongPassword, PASSWORD_POLICY_TEXT } from "../../services/passwordPolicy";
import API from "../../services/api";

function buildParkingSettingsRows(settings) {
  return Array.isArray(settings?.parkingLots)
    ? settings.parkingLots.map((lot) => ({
      id: lot.id,
      parkingName: lot.name || "",
      pricePerHour: lot.pricePerHour || "0",
      pricePerDay: lot.pricePerDay || "0",
      pricePerMonth: lot.pricePerMonth || "0",
      slotCapacity: lot.slotCapacity || 0,
      address: lot.address || "",
      district: lot.district || "",
    }))
    : [];
}

const EMPTY_EDIT_FORM = {
  full_name: "",
  email: "",
  phone: "",
  parking_id: "",
  password: "",
  confirmPassword: "",
};

export default function OwnerSettings() {
  const EMPLOYEE_PASSWORD_MIN_LENGTH = 6;
  const EMPLOYEE_PASSWORD_NOTE = `Mật khẩu nhân viên tối thiểu ${EMPLOYEE_PASSWORD_MIN_LENGTH} ký tự.`;

  const { auth, ownerData, actions } = useOwnerContext();
  const [settingsData, setSettingsData] = useState(ownerData.settings);
  const [ownerForm, setOwnerForm] = useState({
    contactPhone: ownerData.settings.contactPhone || "",
    contactEmail: ownerData.settings.contactEmail || "",
  });
  const [parkingRows, setParkingRows] = useState(() => buildParkingSettingsRows(ownerData.settings));
  const [accountForm, setAccountForm] = useState({
    email: auth?.user?.email || "",
    password: "",
    confirmPassword: "",
  });
  const [ownerSaved, setOwnerSaved] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [savedParkingId, setSavedParkingId] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [employeeCreated, setEmployeeCreated] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    parking_id: "",
  });
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [showEmployeeConfirmPassword, setShowEmployeeConfirmPassword] = useState(false);

  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState(EMPTY_EDIT_FORM);
  const [showEditEmployeePassword, setShowEditEmployeePassword] = useState(false);
  const [showEditEmployeeConfirmPassword, setShowEditEmployeeConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get("/owner/settings");
        const nextSettings = res.data?.settings || ownerData.settings;
        setSettingsData(nextSettings);
        setOwnerForm({
          contactPhone: nextSettings.contactPhone || "",
          contactEmail: nextSettings.contactEmail || "",
        });
        setParkingRows(buildParkingSettingsRows(nextSettings));
      } catch {
        setSettingsData(ownerData.settings);
        setOwnerForm({
          contactPhone: ownerData.settings.contactPhone || "",
          contactEmail: ownerData.settings.contactEmail || "",
        });
        setParkingRows(buildParkingSettingsRows(ownerData.settings));
      }
    };
    fetchSettings();
  }, [ownerData.settings]);

  useEffect(() => {
    setAccountForm((prev) => ({
      ...prev,
      email: auth?.user?.email || "",
    }));
  }, [auth?.user?.email]);

  useEffect(() => {
    setEmployeeForm((prev) => ({
      ...prev,
      parking_id: prev.parking_id || String(parkingRows[0]?.id || ""),
    }));
  }, [parkingRows]);

  useEffect(() => {
    const fetchEmployees = async () => {
      const nextEmployees = await actions.listEmployees();
      setEmployees(nextEmployees);
    };
    fetchEmployees();
  }, []);

  const handleParkingChange = (parkingId, key, value) => {
    setSavedParkingId(null);
    setParkingRows((prev) =>
      prev.map((row) => (row.id === parkingId ? { ...row, [key]: value } : row)),
    );
  };

  const startEditEmployee = (employee) => {
    setEditingEmployeeId(employee.id);
    setEditEmployeeForm({
      full_name: employee.full_name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      parking_id: String(employee.parking_id || ""),
      password: "",
      confirmPassword: "",
    });
    setShowEditEmployeePassword(false);
    setShowEditEmployeeConfirmPassword(false);
  };

  const cancelEditEmployee = () => {
    setEditingEmployeeId(null);
    setEditEmployeeForm(EMPTY_EDIT_FORM);
    setShowEditEmployeePassword(false);
    setShowEditEmployeeConfirmPassword(false);
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

      <SectionCard title="Thông tin owner" subtitle="Thông tin liên hệ và khu vực owner đang được phân công trong hệ thống.">
        <form className="owner-settings-form" onSubmit={async (event) => {
          event.preventDefault();
          const ok = await actions.updateSettings(ownerForm);
          if (ok) {
            setOwnerSaved(true);
            const res = await API.get("/owner/settings");
            const nextSettings = res.data?.settings || settingsData;
            setSettingsData(nextSettings);
          }
        }}>
          <label>
            Họ tên owner
            <input className="owner-input" value={settingsData.contactName || ""} disabled />
          </label>
          <label>
            Quận phụ trách
            <input className="owner-input" value={settingsData.districtName || "Chưa gán"} disabled />
          </label>
          <label>
            Số bãi đang quản lý
            <input className="owner-input" value={settingsData.managedParkingCount || "0"} disabled />
          </label>
          <label>
            Tổng sức chứa toàn bộ bãi
            <input className="owner-input" value={settingsData.totalSlotCapacity || "0"} disabled />
          </label>
          <label>
            Số điện thoại liên hệ
            <input className="owner-input" value={ownerForm.contactPhone} onChange={(event) => {
              setOwnerSaved(false);
              setOwnerForm((prev) => ({ ...prev, contactPhone: event.target.value }));
            }} />
          </label>
          <label>
            Email liên hệ
            <input className="owner-input" value={ownerForm.contactEmail} onChange={(event) => {
              setOwnerSaved(false);
              setOwnerForm((prev) => ({ ...prev, contactEmail: event.target.value }));
            }} />
          </label>
          <div className="owner-settings-actions owner-form-span">
            {ownerSaved ? <p className="owner-save-note">Đã cập nhật thông tin owner.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Lưu thông tin owner</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Giá và cấu hình theo bãi" subtitle="Mỗi bãi owner quản lý dùng dữ liệu thật từ CSDL, không còn cấu hình giả toàn hệ thống.">
        <div className="owner-settings-stack">
          {parkingRows.map((row) => (
            <form
              key={row.id}
              className="owner-settings-form owner-settings-form--card"
              onSubmit={async (event) => {
                event.preventDefault();
                const ok = await actions.updateParkingLotSettings(row.id, {
                  parkingName: row.parkingName,
                  pricePerHour: row.pricePerHour,
                  pricePerDay: row.pricePerDay,
                  pricePerMonth: row.pricePerMonth,
                });
                if (ok) {
                  setSavedParkingId(row.id);
                  const res = await API.get("/owner/settings");
                  const nextSettings = res.data?.settings || settingsData;
                  setSettingsData(nextSettings);
                  setParkingRows(buildParkingSettingsRows(nextSettings));
                }
              }}
            >
              <label className="owner-form-span">
                Tên bãi đỗ
                <input className="owner-input" value={row.parkingName} onChange={(event) => handleParkingChange(row.id, "parkingName", event.target.value)} />
              </label>
              <label className="owner-form-span">
                Địa chỉ
                <input className="owner-input" value={[row.address, row.district].filter(Boolean).join(" • ")} disabled />
              </label>
              <label>
                Số chỗ đỗ
                <input className="owner-input" value={row.slotCapacity} disabled />
              </label>
              <label>
                Giá theo giờ (VND)
                <input className="owner-input" value={row.pricePerHour} onChange={(event) => handleParkingChange(row.id, "pricePerHour", event.target.value)} />
              </label>
              <label>
                Giá theo ngày (VND)
                <input className="owner-input" value={row.pricePerDay} onChange={(event) => handleParkingChange(row.id, "pricePerDay", event.target.value)} />
              </label>
              <label>
                Giá theo tháng (VND)
                <input className="owner-input" value={row.pricePerMonth} onChange={(event) => handleParkingChange(row.id, "pricePerMonth", event.target.value)} />
              </label>
              <div className="owner-settings-actions owner-form-span">
                {savedParkingId === row.id ? <p className="owner-save-note">Đã cập nhật cấu hình bãi.</p> : <span />}
                <button type="submit" className="btn-primary owner-btn">Lưu cấu hình bãi</button>
              </div>
            </form>
          ))}
          {parkingRows.length === 0 ? <p className="owner-empty-cell">Owner hiện chưa được gán bãi đỗ nào.</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="Tài khoản nhân viên" subtitle="Owner tạo, sửa và xóa tài khoản nhân viên. Khi xóa sẽ xóa cứng khỏi cơ sở dữ liệu.">
        <form
          className="owner-settings-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!employeeForm.parking_id) {
              window.alert("Vui lòng chọn bãi phụ trách cho nhân viên");
              return;
            }
            const parkingId = Number(employeeForm.parking_id);
            const allowedParking = parkingRows.some((row) => Number(row.id) === parkingId);
            if (!allowedParking) {
              window.alert("Bạn chỉ có thể tạo nhân viên cho bãi xe thuộc owner hiện tại.");
              return;
            }
            if (!employeeForm.full_name.trim() || !employeeForm.email.trim()) {
              window.alert("Vui lòng nhập đầy đủ họ tên và email");
              return;
            }
            if ((employeeForm.password || "").length < EMPLOYEE_PASSWORD_MIN_LENGTH) {
              window.alert(EMPLOYEE_PASSWORD_NOTE);
              return;
            }
            if (employeeForm.password !== employeeForm.confirmPassword) {
              window.alert("Mật khẩu xác nhận không khớp");
              return;
            }

            const created = await actions.createEmployee({
              full_name: employeeForm.full_name.trim(),
              email: employeeForm.email.trim().toLowerCase(),
              phone: employeeForm.phone.trim() || null,
              password: employeeForm.password,
              parking_id: parkingId,
            });
            if (!created) {
              return;
            }

            setEmployeeCreated(true);
            setEmployeeForm((prev) => ({
              ...prev,
              full_name: "",
              email: "",
              phone: "",
              password: "",
              confirmPassword: "",
            }));
            setShowEmployeePassword(false);
            setShowEmployeeConfirmPassword(false);

            const nextEmployees = await actions.listEmployees();
            setEmployees(nextEmployees);
          }}
        >
          <label>
            Họ tên nhân viên
            <input className="owner-input" value={employeeForm.full_name} onChange={(event) => {
              setEmployeeCreated(false);
              setEmployeeForm((prev) => ({ ...prev, full_name: event.target.value }));
            }} />
          </label>
          <label>
            Email đăng nhập
            <input className="owner-input" type="email" value={employeeForm.email} onChange={(event) => {
              setEmployeeCreated(false);
              setEmployeeForm((prev) => ({ ...prev, email: event.target.value }));
            }} />
          </label>
          <label>
            Số điện thoại
            <input className="owner-input" value={employeeForm.phone} onChange={(event) => {
              setEmployeeCreated(false);
              setEmployeeForm((prev) => ({ ...prev, phone: event.target.value }));
            }} />
          </label>
          <label>
            Bãi phụ trách
            <select className="owner-input owner-select" value={employeeForm.parking_id} onChange={(event) => {
              setEmployeeCreated(false);
              setEmployeeForm((prev) => ({ ...prev, parking_id: event.target.value }));
            }}>
              {parkingRows.map((row) => (
                <option key={row.id} value={row.id}>{row.parkingName}</option>
              ))}
            </select>
          </label>
          <label>
            Mật khẩu
            <div className="owner-password-row">
              <input className="owner-input" type={showEmployeePassword ? "text" : "password"} minLength={EMPLOYEE_PASSWORD_MIN_LENGTH} value={employeeForm.password} onChange={(event) => {
                setEmployeeCreated(false);
                setEmployeeForm((prev) => ({ ...prev, password: event.target.value }));
              }} />
              <button
                type="button"
                className="btn-secondary owner-btn owner-password-toggle"
                onClick={() => setShowEmployeePassword((prev) => !prev)}
              >
                {showEmployeePassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </label>
          <label>
            Nhập lại mật khẩu
            <div className="owner-password-row">
              <input className="owner-input" type={showEmployeeConfirmPassword ? "text" : "password"} minLength={EMPLOYEE_PASSWORD_MIN_LENGTH} value={employeeForm.confirmPassword} onChange={(event) => {
                setEmployeeCreated(false);
                setEmployeeForm((prev) => ({ ...prev, confirmPassword: event.target.value }));
              }} />
              <button
                type="button"
                className="btn-secondary owner-btn owner-password-toggle"
                onClick={() => setShowEmployeeConfirmPassword((prev) => !prev)}
              >
                {showEmployeeConfirmPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </label>
          <p className="owner-save-note owner-form-span">{EMPLOYEE_PASSWORD_NOTE}</p>
          <div className="owner-settings-actions owner-form-span">
            {employeeCreated ? <p className="owner-save-note">Đã tạo tài khoản nhân viên thành công.</p> : <span />}
            <button type="submit" className="btn-primary owner-btn">Tạo tài khoản nhân viên</button>
          </div>
        </form>

        <div className="owner-table-shell">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Bãi phụ trách</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="owner-empty-cell">Chưa có tài khoản nhân viên nào.</td>
                </tr>
              ) : employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.full_name || employee.username}</td>
                  <td>{employee.email || "-"}</td>
                  <td>{employee.phone || "-"}</td>
                  <td>{employee.parking_name || `Bãi #${employee.parking_id}`}</td>
                  <td>
                    <span className={`owner-badge ${employee.status === "active" ? "owner-badge--success" : "owner-badge--warning"}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td>
                    <div className="owner-row-actions">
                      <button
                        type="button"
                        className="btn-secondary owner-btn owner-btn--small"
                        onClick={() => startEditEmployee(employee)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn-secondary owner-btn owner-btn--small owner-btn--danger"
                        onClick={async () => {
                          const ok = window.confirm("Xóa tài khoản nhân viên này vĩnh viễn?");
                          if (!ok) {
                            return;
                          }
                          const deleted = await actions.deleteEmployee(employee.id);
                          if (!deleted) {
                            return;
                          }
                          if (editingEmployeeId === employee.id) {
                            cancelEditEmployee();
                          }
                          const nextEmployees = await actions.listEmployees();
                          setEmployees(nextEmployees);
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingEmployeeId ? (
          <form
            className="owner-settings-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const parkingId = Number(editEmployeeForm.parking_id);
              const allowedParking = parkingRows.some((row) => Number(row.id) === parkingId);
              if (!allowedParking) {
                window.alert("Bạn chỉ có thể gán nhân viên vào bãi thuộc owner hiện tại.");
                return;
              }
              if (!editEmployeeForm.full_name.trim() || !editEmployeeForm.email.trim()) {
                window.alert("Vui lòng nhập đầy đủ họ tên và email");
                return;
              }
              if (editEmployeeForm.password && editEmployeeForm.password.length < EMPLOYEE_PASSWORD_MIN_LENGTH) {
                window.alert(EMPLOYEE_PASSWORD_NOTE);
                return;
              }
              if (editEmployeeForm.password !== editEmployeeForm.confirmPassword) {
                window.alert("Mật khẩu xác nhận không khớp");
                return;
              }

              const payload = {
                full_name: editEmployeeForm.full_name.trim(),
                email: editEmployeeForm.email.trim().toLowerCase(),
                phone: editEmployeeForm.phone.trim() || null,
                parking_id: parkingId,
              };
              if (editEmployeeForm.password) {
                payload.password = editEmployeeForm.password;
              }

              const updated = await actions.updateEmployee(editingEmployeeId, payload);
              if (!updated) {
                return;
              }

              const nextEmployees = await actions.listEmployees();
              setEmployees(nextEmployees);
              cancelEditEmployee();
            }}
          >
            <label className="owner-form-span">Chỉnh sửa tài khoản nhân viên</label>
            <label>
              Họ tên nhân viên
              <input
                className="owner-input"
                value={editEmployeeForm.full_name}
                onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, full_name: event.target.value }))}
              />
            </label>
            <label>
              Email đăng nhập
              <input
                className="owner-input"
                type="email"
                value={editEmployeeForm.email}
                onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Số điện thoại
              <input
                className="owner-input"
                value={editEmployeeForm.phone}
                onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              Bãi phụ trách
              <select
                className="owner-input owner-select"
                value={editEmployeeForm.parking_id}
                onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, parking_id: event.target.value }))}
              >
                {parkingRows.map((row) => (
                  <option key={row.id} value={row.id}>{row.parkingName}</option>
                ))}
              </select>
            </label>
            <label>
              Mật khẩu mới (tùy chọn)
              <div className="owner-password-row">
                <input
                  className="owner-input"
                  type={showEditEmployeePassword ? "text" : "password"}
                  minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                  value={editEmployeeForm.password}
                  onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <button
                  type="button"
                  className="btn-secondary owner-btn owner-password-toggle"
                  onClick={() => setShowEditEmployeePassword((prev) => !prev)}
                >
                  {showEditEmployeePassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>
            <label>
              Nhập lại mật khẩu mới
              <div className="owner-password-row">
                <input
                  className="owner-input"
                  type={showEditEmployeeConfirmPassword ? "text" : "password"}
                  minLength={EMPLOYEE_PASSWORD_MIN_LENGTH}
                  value={editEmployeeForm.confirmPassword}
                  onChange={(event) => setEditEmployeeForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
                <button
                  type="button"
                  className="btn-secondary owner-btn owner-password-toggle"
                  onClick={() => setShowEditEmployeeConfirmPassword((prev) => !prev)}
                >
                  {showEditEmployeeConfirmPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>
            <p className="owner-save-note owner-form-span">{EMPLOYEE_PASSWORD_NOTE}</p>
            <div className="owner-settings-actions owner-form-span">
              <button type="button" className="btn-secondary owner-btn" onClick={cancelEditEmployee}>Hủy</button>
              <button type="submit" className="btn-primary owner-btn">Lưu chỉnh sửa</button>
            </div>
          </form>
        ) : null}
      </SectionCard>
    </div>
  );
}