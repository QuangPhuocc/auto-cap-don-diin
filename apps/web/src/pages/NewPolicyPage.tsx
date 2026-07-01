import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tạo đơn TNDS ô tô</h2>
        <p className="text-muted-foreground">Điền thông tin bảo hiểm chính xác trước khi nhấn phát hành</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin phát hành bảo hiểm bắt buộc</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {/* Ẩn Giới tính (mặc định NAM) và Email (mặc định qphuocins@gmail.com) */}
            <input type="hidden" name="gender" value="NAM" />
            <input type="hidden" name="email" value="qphuocins@gmail.com" />

            <div className="grid gap-4 md:grid-cols-2">
              
              {/* 1. Số điện thoại nhận GCN */}
              <Field label="Số điện thoại nhận GCN" name="phone" />

              {/* 2. Họ tên chủ xe */}
              <Field label="Họ tên chủ xe" name="customerName" />

              {/* 3. Địa chỉ trên đăng ký */}
              <div className="md:col-span-2">
                <Field label="Địa chỉ trên đăng ký" name="address" />
              </div>

              {/* 4. Biển số */}
              <Field label="Biển số" name="plateNumber" />

              {/* 5. Số khung */}
              <Field label="Số khung" name="chassisNumber" />

              {/* 6. Số máy */}
              <Field label="Số máy" name="engineNumber" />

              {/* 7. Loại xe (Mặc định chọn xe ô tô không KD) */}
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Loại xe</Label>
                <Select id="vehicleType" name="vehicleType" required defaultValue="XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT">
                  {vehicleTypes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>

              {/* 8. Số chỗ ngồi */}
              <Field label="Số chỗ ngồi" name="seatCount" type="number" required defaultValue={5} />

              {/* 9. Ngày bắt đầu hiệu lực */}
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Ngày bắt đầu hiệu lực</Label>
                <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={defaultDate} />
              </div>

              {/* 10. Giờ & Phút hiệu lực */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="effectiveHour">Giờ hiệu lực</Label>
                  <Select id="effectiveHour" name="effectiveHour" required defaultValue={defaultHour}>
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = String(i).padStart(2, "0");
                      return <option key={h} value={h}>{h} giờ</option>;
                    })}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effectiveMinute">Phút hiệu lực</Label>
                  <Select id="effectiveMinute" name="effectiveMinute" required defaultValue={defaultMinute}>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const m = String(i * 5).padStart(2, "0");
                      return <option key={m} value={m}>{m} phút</option>;
                    })}
                  </Select>
                </div>
              </div>

              {/* 11. Số năm bảo hiểm */}
              <div className="space-y-2">
                <Label htmlFor="insuranceYears">Số năm bảo hiểm</Label>
                <Select id="insuranceYears" name="insuranceYears" required defaultValue={1}>
                  <option value={1}>1 năm</option>
                  <option value={2}>2 năm</option>
                  <option value={3}>3 năm</option>
                </Select>
              </div>

              {/* 12. Số chỗ mua NNTX */}
              <Field label="Số chỗ mua NNTX" name="passengerCount" type="number" required defaultValue={0} />

              {/* 13. Phí bảo hiểm/ 1 chỗ ngồi (NNTX) */}
              <div className="space-y-2">
                <Label htmlFor="passengerFee">Phí bảo hiểm/ 1 chỗ ngồi (NNTX)</Label>
                <Select id="passengerFee" name="passengerFee" required defaultValue={0}>
                  {passengerFees.map((f) => (
                    <option key={f} value={f}>{f.toLocaleString("vi-VN")}đ</option>
                  ))}
                </Select>
              </div>

              {/* 14. Đại lý */}
              <Field label="Đại lý" name="agent" required={false} />

            </div>

            {message && (
              <p className={`rounded-lg p-3 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {message.text}
              </p>
            )}

            <Button disabled={busy} className="w-full md:w-auto px-6 py-2.5">
              <Send size={17} className="mr-2 inline" />
              {busy ? "Đang gửi yêu cầu phát hành..." : "Phát hành bảo hiểm"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
