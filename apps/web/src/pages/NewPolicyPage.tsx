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

  // Default values
  const now = new Date();
  const defaultDate = now.toISOString().split("T")[0];
  const defaultHour = String(now.getHours()).padStart(2, "0");
  const defaultMinute = String(now.getMinutes()).padStart(2, "0");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const f = new FormData(e.currentTarget);
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
      setMessage({ ok: true, text: `Đã xếp hàng xử lý thành công. Mã job: ${r.jobId}` });
      e.currentTarget.reset();
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
            <div className="grid gap-4 md:grid-cols-2">
              
              {/* Họ tên & Giới tính */}
              <Field label="Họ tên chủ xe" name="customerName" />
              <div className="space-y-2">
                <Label htmlFor="gender">Giới tính</Label>
                <Select id="gender" name="gender" required defaultValue="NAM">
                  <option value="NAM">Nam</option>
                  <option value="NỮ">Nữ</option>
                </Select>
              </div>

              {/* Địa chỉ */}
              <div className="md:col-span-2">
                <Field label="Địa chỉ" name="address" />
              </div>

              {/* Biển số */}
              <Field label="Biển số" name="plateNumber" />

              {/* Số khung */}
              <Field label="Số khung" name="chassisNumber" />

              {/* Số máy */}
              <Field label="Số máy" name="engineNumber" />

              {/* Loại xe */}
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Loại xe</Label>
                <Select id="vehicleType" name="vehicleType" required defaultValue="">
                  <option value="" disabled>Chọn loại xe</option>
                  {vehicleTypes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>

              {/* Số chỗ ngồi */}
              <Field label="Số chỗ ngồi" name="seatCount" type="number" required defaultValue={5} />

              {/* Ngày bắt đầu hiệu lực */}
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Ngày bắt đầu hiệu lực</Label>
                <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={defaultDate} />
              </div>

              {/* Giờ & Phút */}
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
                    {Array.from({ length: 60 }).map((_, i) => {
                      const m = String(i).padStart(2, "0");
                      return <option key={m} value={m}>{m} phút</option>;
                    })}
                  </Select>
                </div>
              </div>

              {/* Số năm bảo hiểm */}
              <div className="space-y-2">
                <Label htmlFor="insuranceYears">Số năm bảo hiểm</Label>
                <Select id="insuranceYears" name="insuranceYears" required defaultValue={1}>
                  <option value={1}>1 năm</option>
                  <option value={2}>2 năm</option>
                  <option value={3}>3 năm</option>
                </Select>
              </div>

              {/* Số hành khách được bảo hiểm (NNTX) */}
              <Field label="Số chỗ mua NNTX" name="passengerCount" type="number" required defaultValue={0} />

              {/* Phí bảo hiểm/ 1 chỗ ngồi */}
              <div className="space-y-2">
                <Label htmlFor="passengerFee">Phí bảo hiểm/ 1 chỗ ngồi (NNTX)</Label>
                <Select id="passengerFee" name="passengerFee" required defaultValue={0}>
                  {passengerFees.map((f) => (
                    <option key={f} value={f}>{f.toLocaleString("vi-VN")}đ</option>
                  ))}
                </Select>
              </div>

              {/* Email, SDT, Dai ly */}
              <div className="md:col-span-2 grid gap-4 grid-cols-1 md:grid-cols-3">
                <Field label="Email nhận GCN" name="email" type="email" required={false} />
                <Field label="Số điện thoại nhận GCN" name="phone" />
                <Field label="Đại lý" name="agent" required={false} />
              </div>

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
