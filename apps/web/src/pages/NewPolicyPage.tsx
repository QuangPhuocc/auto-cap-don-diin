import { Send } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const vehicleTypes = [
  "XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT",
  "XE Ô TÔ KD VẬN TẢI",
  "Vừa chở hàng và người (Mini van, Pickup) Không KD",
  "Vừa chở hàng và người (Mini van, Pickup) Kinh doanh",
  "XE ĐẦU KÉO các loại (Không KD)",
  "XE ĐẦU KÉO các loại (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 8 đến 15 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 15 tấn (Không kinh doanh)",
  "XE Ô TÔ CHUYÊN DÙNG Dưới 3 tấn",
  "XE Ô TÔ CHUYÊN DÙNG Xe cứu thương"
];

const passengerFees = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];

const Field = ({
  label,
  name,
  type = "text",
  required = true,
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
}) => (
  <div className="space-y-2">
    <Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
  </div>
);

export function NewPolicyPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isSpecialUser = user
    ? user.role === "ADMIN" ||
      ["LINH", "PHƯỚC", "YÊN", "DIỄM", "NHI"].includes(user.fullName.toUpperCase()) ||
      ["0962731468", "0906643381", "0942542249", "0981740680", "0931183389"].includes(user.username)
    : false;

  const defaultList = ["PHƯỚC", "LINH", "NHI", "DIỄM", "YÊN", "DUY THƯƠNG"];
  const [issuerMode, setIssuerMode] = useState<"select" | "custom">("select");
  const [selectedIssuer, setSelectedIssuer] = useState<string>("");
  const [customIssuer, setCustomIssuer] = useState<string>("");

  useEffect(() => {
    if (user) {
      const uName = user.fullName.toUpperCase();
      if (defaultList.includes(uName)) {
        setIssuerMode("select");
        setSelectedIssuer(uName);
      } else {
        setIssuerMode("custom");
        setCustomIssuer(user.fullName);
      }
    }
  }, [user]);

  // Default values: cộng 10 phút, làm tròn về đuôi 5 hoặc 10
  const now = new Date();
  const target = new Date(now.getTime() + 10 * 60 * 1000);
  let m = target.getMinutes();
  let roundedM = Math.ceil(m / 5) * 5;
  if (roundedM === 60) {
    target.setHours(target.getHours() + 1);
    roundedM = 0;
  }
  target.setMinutes(roundedM);

  const defaultDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  const defaultHour = String(target.getHours()).padStart(2, "0");
  const defaultMinute = String(target.getMinutes()).padStart(2, "0");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    const f = new FormData(form);
    const body = Object.fromEntries(f.entries());

    if (!body.seatCount) delete body.seatCount;

    // Combine Date, Hour, Minute
    const dateStr = body.effectiveDate;
    const hour = body.effectiveHour || "00";
    const minute = body.effectiveMinute || "00";
    body.effectiveDate = new Date(`${dateStr}T${hour}:${minute}:00`).toISOString();
    
    delete body.effectiveHour;
    delete body.effectiveMinute;

    try {
      const r = await api<{ jobId: string }>("/policies/single", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setMessage({ ok: true, text: "Đã phát hành" });
      localStorage.setItem("hasNewPolicy", "true");
      window.dispatchEvent(new Event("newPolicyIssued"));
      form.reset();
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Không tạo được đơn"
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pt-4">
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <CardTitle className="text-xl font-bold text-stone-800">Tạo đơn Bảo hiểm BB TNDS</CardTitle>
            <Button type="submit" disabled={busy} className="px-6 py-2 flex items-center gap-2">
              <Send size={15} />
              {busy ? "Đang gửi..." : "Phát hành"}
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Ẩn Giới tính (mặc định NAM) và Email (mặc định qphuocins@gmail.com) */}
            <input type="hidden" name="gender" value="NAM" />
            <input type="hidden" name="email" value="qphuocins@gmail.com" />

            <div className="grid gap-4 md:grid-cols-6">
              
              {/* Dòng 1: Cấu hình động theo tài khoản */}
              {isSpecialUser ? (
                <>
                  {issuerMode === "select" ? (
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="issuerSelect">Người cấp</Label>
                      <Select
                        id="issuerSelect"
                        value={selectedIssuer}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIssuerMode("custom");
                          } else {
                            setSelectedIssuer(e.target.value);
                          }
                        }}
                      >
                        {defaultList.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="__custom__">✍️ Gõ tên khác...</option>
                      </Select>
                      <input type="hidden" name="issuerName" value={selectedIssuer} />
                    </div>
                  ) : (
                    <div className="md:col-span-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="customIssuerInput">Người cấp</Label>
                        <button
                          type="button"
                          onClick={() => setIssuerMode("select")}
                          className="text-xs text-orange-600 hover:underline"
                        >
                          Chọn từ danh sách
                        </button>
                      </div>
                      <Input
                        id="customIssuerInput"
                        name="issuerName"
                        value={customIssuer}
                        onChange={(e) => setCustomIssuer(e.target.value)}
                        placeholder="Nhập tên người cấp"
                        required
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <Field label="Đại lý" name="agent" required={false} />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-3">
                    <Field label="Đại lý" name="agent" required={false} />
                  </div>
                  <div className="md:col-span-3">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} />
                  </div>
                </>
              )}

              {/* Dòng 2: Tên chủ xe - Biển số */}
              <div className="md:col-span-3">
                <Field label="Họ tên chủ xe" name="customerName" />
              </div>
              <div className="md:col-span-3">
                <Field label="Biển số" name="plateNumber" />
              </div>

              {/* Dòng 3: Địa chỉ */}
              <div className="md:col-span-6">
                <Field label="Địa chỉ trên đăng ký" name="address" />
              </div>

              {/* Dòng 4: Số khung - Số máy */}
              <div className="md:col-span-3">
                <Field label="Số khung" name="chassisNumber" />
              </div>
              <div className="md:col-span-3">
                <Field label="Số máy" name="engineNumber" />
              </div>

              {/* Dòng 5: Loại xe - Số chỗ ngồi - Ngày bắt đầu */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="vehicleType">Loại xe</Label>
                <Select id="vehicleType" name="vehicleType" required defaultValue="XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT">
                  {vehicleTypes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Field label="Số chỗ ngồi" name="seatCount" type="number" required defaultValue={5} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="effectiveDate">Ngày bắt đầu hiệu lực</Label>
                <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={defaultDate} />
              </div>

              {/* Dòng 6: Giờ - Phút - Số năm bảo hiểm */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="effectiveHour">Giờ hiệu lực</Label>
                <Select id="effectiveHour" name="effectiveHour" required defaultValue={defaultHour}>
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = String(i).padStart(2, "0");
                    return <option key={h} value={h}>{h} giờ</option>;
                  })}
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="effectiveMinute">Phút hiệu lực</Label>
                <Select id="effectiveMinute" name="effectiveMinute" required defaultValue={defaultMinute}>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = String(i * 5).padStart(2, "0");
                    return <option key={m} value={m}>{m} phút</option>;
                  })}
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="insuranceYears">Số năm bảo hiểm</Label>
                <Select id="insuranceYears" name="insuranceYears" required defaultValue={1}>
                  <option value={1}>1 năm</option>
                  <option value={2}>2 năm</option>
                  <option value={3}>3 năm</option>
                </Select>
              </div>

              {/* Dòng 7: Số chỗ mua NNTX - Phí bảo hiểm/ 1 chỗ ngồi (NNTX) */}
              <div className="md:col-span-3">
                <Field label="Số chỗ mua NNTX" name="passengerCount" type="number" required defaultValue={0} />
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label htmlFor="passengerFee">Phí bảo hiểm/ 1 chỗ ngồi (NNTX)</Label>
                <Select id="passengerFee" name="passengerFee" required defaultValue={0}>
                  {passengerFees.map((f) => (
                    <option key={f} value={f}>{f.toLocaleString("vi-VN")}đ</option>
                  ))}
                </Select>
              </div>

            </div>

            {message && (
              <p className={`rounded-lg p-3 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
