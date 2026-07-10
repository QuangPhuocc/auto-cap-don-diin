import { Send } from "lucide-react";
import { FormEvent, useState, useEffect, useRef, InputHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { removeVietnameseTones, restoreTelexAndUppercase, formatPlateNumber } from "../lib/utils";

const vehicleTypes = [
  "XE BUÝT",
  "XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT",
  "XE Ô TÔ KD VẬN TẢI",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 8 đến 15 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 15 tấn (Kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 8 đến 15 tấn (Không kinh doanh)",
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 15 tấn (Không kinh doanh)",
  "Vừa chở hàng và người (Mini van, Pickup) Không KD",
  "Vừa chở hàng và người (Mini van, Pickup) Kinh doanh",
  "XE TAXI",
  "XE ĐẦU KÉO các loại (Kinh doanh)",
  "XE ĐẦU KÉO các loại (Không KD)",
  "XE ĐẦU KÉO tập lái các loại",
  "XE Ô TÔ CHUYÊN DÙNG Dưới 3 tấn",
  "XE Ô TÔ CHUYÊN DÙNG Từ 3 đến 8 tấn",
  "XE Ô TÔ CHUYÊN DÙNG Trên 8 đến 15 tấn",
  "XE Ô TÔ CHUYÊN DÙNG Trên 15 tấn",
  "XE Ô TÔ CHUYÊN DÙNG Xe cứu thương",
  "XE Ô TÔ CHUYÊN DÙNG Xe chở tiền",
  "XE TẬP LÁI (CHỞ NGƯỜI)",
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Dưới 3 tấn",
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Từ 3 đến 8 tấn",
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Trên 8 đến 15 tấn",
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Trên 15 tấn"
];

const passengerFees = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];

const Field = ({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1">
    <Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} {...props} />
  </div>
);

function getInitialEffectiveDate() {
  const now = new Date();
  const target = new Date(now.getTime() + 10 * 60 * 1000);
  let m = target.getMinutes();
  let roundedM = Math.ceil(m / 5) * 5;
  if (roundedM === 60) {
    target.setHours(target.getHours() + 1);
    roundedM = 0;
  }
  target.setMinutes(roundedM);
  return `${String(target.getDate()).padStart(2, "0")}/${String(target.getMonth() + 1).padStart(2, "0")}/${target.getFullYear()}`;
}

export function NewPolicyPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [hasNewPolicy, setHasNewPolicy] = useState(
    localStorage.getItem("hasNewPolicy") === "true"
  );

  const submittingRef = useRef(false);

  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [seatCount, setSeatCount] = useState<number>(5);
  const [hasNntx, setHasNntx] = useState(false);
  const [effectiveDateText, setEffectiveDateText] = useState(getInitialEffectiveDate);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 8) {
      val = val.substring(0, 8);
    }
    let formatted = "";
    if (val.length > 0) {
      formatted += val.substring(0, 2);
    }
    if (val.length > 2) {
      formatted += "/" + val.substring(2, 4);
    }
    if (val.length > 4) {
      formatted += "/" + val.substring(4, 8);
    }
    setEffectiveDateText(formatted);
  };

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processOcrFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processOcrFile(e.target.files[0]);
    }
  };

  const processOcrFile = async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setOcrError("Chỉ chấp nhận file ảnh (PNG, JPG) hoặc tài liệu PDF");
      setOcrSuccess(null);
      return;
    }

    setOcrLoading(true);
    setOcrError(null);
    setOcrSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api<{
        success: boolean;
        data: {
          phone?: string;
          customerName?: string;
          address?: string;
          plateNumber?: string;
          chassisNumber?: string;
          engineNumber?: string;
          seatCount?: number;
        };
        message?: string;
      }>("/policies/ocr", {
        method: "POST",
        body: formData,
      });

      if (res.success && res.data) {
        const { phone: ocrPhone, customerName: ocrName, address: ocrAddr, plateNumber: ocrPlate, chassisNumber: ocrChassis, engineNumber: ocrEngine, seatCount: ocrSeats } = res.data;
        
        if (ocrPhone) setPhone(ocrPhone);
        if (ocrName) setCustomerName(ocrName);
        if (ocrAddr) setAddress(ocrAddr);
        if (ocrPlate) setPlateNumber(ocrPlate);
        if (ocrChassis) setChassisNumber(ocrChassis);
        if (ocrEngine) setEngineNumber(ocrEngine);
        if (ocrSeats) setSeatCount(ocrSeats);

        setOcrSuccess("Nhận diện thông tin và điền form tự động thành công!");
      } else {
        setOcrError(res.message || "Nhận diện thông tin thất bại. Vui lòng tự nhập tay.");
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Không thể kết nối đến máy chủ để nhận diện OCR");
    } finally {
      setOcrLoading(false);
    }
  };

  useEffect(() => {
    const handleNewPolicy = () => {
      setHasNewPolicy(true);
    };
    window.addEventListener("newPolicyIssued", handleNewPolicy);
    return () => {
      window.removeEventListener("newPolicyIssued", handleNewPolicy);
    };
  }, []);

  const handleInput = (e: FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const originalValue = input.value;
    const cleanedValue = restoreTelexAndUppercase(originalValue);
    if (originalValue !== cleanedValue) {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      input.value = cleanedValue;
      if (selectionStart !== null && selectionEnd !== null) {
        const diff = cleanedValue.length - originalValue.length;
        input.setSelectionRange(selectionStart + diff, selectionEnd + diff);
      }
    }
  };

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

  const defaultHour = String(target.getHours()).padStart(2, "0");
  const defaultMinute = String(target.getMinutes()).padStart(2, "0");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    const f = new FormData(form);
    const body = Object.fromEntries(f.entries());

    // Validate agent & phone: if user is special, and agent is empty, phone is required
    const specialUsernames = ["0962731468", "0906643381", "0942542249", "0981740680", "0931183389"];
    const specialFullNames = ["LINH", "PHƯỚC", "YÊN", "DIỄM", "NHI"];
    const isSpecialAccount = user && (
      specialUsernames.includes(user.username) || 
      specialFullNames.includes(user.fullName.toUpperCase())
    );

    if (isSpecialAccount) {
      const agent = String(body.agent || "").trim();
      const phone = String(body.phone || "").trim();
      if (!agent && !phone) {
        setMessage({
          ok: false,
          text: "Vui lòng nhập Số điện thoại nhận GCN hoặc Đại lý"
        });
        setBusy(false);
        submittingRef.current = false;
        return;
      }
    }

    // Validate NNTX <= seatCount
    const seat = Number(body.seatCount || 0);
    const passenger = Number(body.passengerCount || 0);
    if (passenger > seat) {
      setMessage({
        ok: false,
        text: "Số chỗ mua NNTX lớn hơn Số chỗ ngồi trên xe"
      });
      setBusy(false);
      submittingRef.current = false;
      return;
    }

    // Validate plate and chassis/engine constraints
    const plate = String(body.plateNumber || "").trim();
    const chassis = String(body.chassisNumber || "").trim();
    const engine = String(body.engineNumber || "").trim();

    const hasPlate = plate !== "" && plate !== "0";
    const hasChassis = chassis !== "" && chassis !== "0";
    const hasEngine = engine !== "" && engine !== "0";

    if (!hasPlate && !(hasChassis && hasEngine)) {
      setMessage({
        ok: false,
        text: "Vui lòng cung cấp Biển số xe hoặc cặp Số khung + Số máy"
      });
      setBusy(false);
      submittingRef.current = false;
      return;
    }

    let plateVal = plate || "0";
    let chassisVal = chassis || "0";
    let engineVal = engine || "0";

    if (plateVal !== "0") {
      plateVal = formatPlateNumber(restoreTelexAndUppercase(plateVal));
    }
    if (chassisVal !== "0") {
      chassisVal = restoreTelexAndUppercase(chassisVal).trim().toUpperCase();
    }
    if (engineVal !== "0") {
      engineVal = restoreTelexAndUppercase(engineVal).trim().toUpperCase();
    }

    body.plateNumber = plateVal;
    body.chassisNumber = chassisVal;
    body.engineNumber = engineVal;

    if (!body.seatCount) delete body.seatCount;

    // Validate & format effectiveDate
    const dateStr = String(body.effectiveDate || "").trim();
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = dateStr.match(dateRegex);
    if (!dateMatch) {
      setMessage({
        ok: false,
        text: "Ngày bắt đầu hiệu lực phải theo định dạng dd/mm/yyyy"
      });
      setBusy(false);
      submittingRef.current = false;
      return;
    }
    const [_, day, month, year] = dateMatch;
    const dVal = parseInt(day, 10);
    const mVal = parseInt(month, 10);
    const yVal = parseInt(year, 10);
    if (mVal < 1 || mVal > 12 || dVal < 1 || dVal > 31) {
      setMessage({
        ok: false,
        text: "Ngày hoặc tháng hiệu lực không hợp lệ"
      });
      setBusy(false);
      submittingRef.current = false;
      return;
    }
    const dateYMD = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const parsedDate = new Date(`${dateYMD}T00:00:00`);
    if (isNaN(parsedDate.getTime())) {
      setMessage({
        ok: false,
        text: "Ngày hiệu lực không tồn tại"
      });
      setBusy(false);
      submittingRef.current = false;
      return;
    }

    // Combine Date, Hour, Minute
    const hour = body.effectiveHour || "00";
    const minute = body.effectiveMinute || "00";
    body.effectiveDate = new Date(`${dateYMD}T${hour}:${minute}:00`).toISOString();
    
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
      setPhone("");
      setCustomerName("");
      setAddress("");
      setPlateNumber("");
      setChassisNumber("");
      setEngineNumber("");
      setSeatCount(5);
      setOcrSuccess(null);
      setOcrError(null);
      setEffectiveDateText(getInitialEffectiveDate());
      setHasNntx(false);
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Không tạo được đơn"
      });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl pt-2">
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
            <CardTitle className="text-lg font-bold text-stone-800">Tạo đơn Bảo hiểm BB TNDS</CardTitle>
            <div className="flex items-center gap-2">
              <Link to="/policies" className="relative">
                <Button type="button" variant="outline" className="px-3 py-1.5 h-9 relative flex items-center gap-1.5 text-xs">
                  Danh sách đơn
                  {hasNewPolicy && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </Button>
              </Link>
              <Button type="submit" disabled={busy} className="px-4 py-1.5 h-9 flex items-center gap-1.5 text-xs">
                <Send size={13} />
                {busy ? "Đang gửi..." : "Phát hành"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Ẩn Giới tính (mặc định NAM) và Email (mặc định qphuocins@gmail.com) */}
            <input type="hidden" name="gender" value="NAM" />
            <input type="hidden" name="email" value="qphuocins@gmail.com" />

            {/* OCR Dropzone */}
            <div className="space-y-2">
              <div 
                className={`relative flex flex-col md:flex-row items-center justify-between border border-dashed rounded-lg p-3 transition-all duration-300 ${
                  dragActive 
                    ? "border-orange-500 bg-orange-50/50 scale-[1.01]" 
                    : "border-stone-200 hover:border-orange-400 bg-stone-50/30 hover:bg-orange-50/10"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  id="ocr-file-upload" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  onChange={handleFileChange}
                  disabled={ocrLoading}
                />
                
                {ocrLoading ? (
                  <div className="flex items-center gap-3 py-1 w-full justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                    <p className="text-xs font-semibold text-stone-600 animate-pulse">Đang quét ảnh/PDF và nhận diện thông tin...</p>
                  </div>
                ) : (
                  <label 
                    htmlFor="ocr-file-upload" 
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-stone-700">Tự động điền thông tin bằng OCR</p>
                        <p className="text-[10px] text-stone-400">Chọn hoặc kéo thả Đăng ký / Đăng kiểm / Hoá đơn (PDF, JPG, PNG)</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white border border-stone-200 hover:border-orange-500 rounded-md text-[11px] font-bold text-orange-600 hover:bg-orange-50 transition-colors shadow-sm whitespace-nowrap">
                      Chọn tệp tài liệu
                    </div>
                  </label>
                )}
              </div>
              {ocrSuccess && (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-lg animate-fadeIn">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {ocrSuccess}
                </div>
              )}
              {ocrError && (
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg animate-fadeIn">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {ocrError}
                </div>
              )}
            </div>

            <hr className="my-4 border-stone-100" />

            <div className="grid gap-3 grid-cols-1 md:grid-cols-12">
              
              {/* Dòng 1: Cấu hình động theo tài khoản */}
              {isSpecialUser ? (
                <>
                  {issuerMode === "select" ? (
                    <div className="col-span-1 md:col-span-4 space-y-1">
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
                    <div className="col-span-1 md:col-span-4 space-y-1">
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
                  <div className="col-span-1 md:col-span-4">
                    <Field label="Đại lý" name="agent" required={false} />
                  </div>
                  <div className="col-span-1 md:col-span-4">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-1 md:col-span-6">
                    <Field label="Đại lý" name="agent" required={false} />
                  </div>
                  <div className="col-span-1 md:col-span-6">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </>
              )}

              {/* Dòng 2: Họ tên chủ xe - Địa chỉ trên đăng ký */}
              <div className="col-span-1 md:col-span-6">
                <Field label="Họ tên chủ xe" name="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="col-span-1 md:col-span-6">
                <Field label="Địa chỉ trên đăng ký" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              {/* Dòng 3: Biển số - Số khung - Số máy */}
              <div className="col-span-1 md:col-span-4">
                <Field
                  label="Biển số"
                  name="plateNumber"
                  required={false}
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(restoreTelexAndUppercase(e.target.value))}
                  onBlur={(e) => {
                    setPlateNumber(formatPlateNumber(e.target.value));
                  }}
                />
              </div>
              <div className="col-span-1 md:col-span-4">
                <Field
                  label="Số khung"
                  name="chassisNumber"
                  required={false}
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(restoreTelexAndUppercase(e.target.value))}
                />
              </div>
              <div className="col-span-1 md:col-span-4">
                <Field
                  label="Số máy"
                  name="engineNumber"
                  required={false}
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(restoreTelexAndUppercase(e.target.value))}
                />
              </div>

              {/* Dòng 4: Loại xe - Số chỗ ngồi */}
              <div className="col-span-1 md:col-span-8 space-y-1">
                <Label htmlFor="vehicleType">Loại xe</Label>
                <Select id="vehicleType" name="vehicleType" required defaultValue="XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT">
                  {vehicleTypes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-1 md:col-span-4">
                <Field label="Số chỗ ngồi" name="seatCount" type="number" required value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))} />
              </div>

              {/* Dòng 5: Ngày bắt đầu - Giờ - Phút - Số năm bảo hiểm */}
              <div className="col-span-1 md:col-span-4 space-y-1">
                <Label htmlFor="effectiveDate">Ngày bắt đầu hiệu lực</Label>
                <Input 
                  id="effectiveDate" 
                  name="effectiveDate" 
                  type="text" 
                  placeholder="dd/mm/yyyy"
                  required 
                  value={effectiveDateText} 
                  onChange={handleDateChange} 
                />
              </div>
              <div className="col-span-1 md:col-span-3 space-y-1">
                <Label htmlFor="effectiveHour">Giờ hiệu lực</Label>
                <Select id="effectiveHour" name="effectiveHour" required defaultValue={defaultHour}>
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = String(i).padStart(2, "0");
                    return <option key={h} value={h}>{h} giờ</option>;
                  })}
                </Select>
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <Label htmlFor="effectiveMinute">Phút</Label>
                <Select id="effectiveMinute" name="effectiveMinute" required defaultValue={defaultMinute}>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = String(i * 5).padStart(2, "0");
                    return <option key={m} value={m}>{m} phút</option>;
                  })}
                </Select>
              </div>
              <div className="col-span-1 md:col-span-3 space-y-1">
                <Label htmlFor="insuranceYears">Số năm BH</Label>
                <Select id="insuranceYears" name="insuranceYears" required defaultValue={1}>
                  <option value={1}>1 năm</option>
                  <option value={2}>2 năm</option>
                  <option value={3}>3 năm</option>
                </Select>
              </div>

              {/* Dòng 6: Checkbox NNTX */}
              <div className="col-span-1 md:col-span-12 flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="hasNntx" 
                  checked={hasNntx} 
                  onChange={(e) => setHasNntx(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <Label htmlFor="hasNntx" className="text-xs font-bold text-stone-700 cursor-pointer select-none">
                  Mua thêm bảo hiểm Tai nạn Người ngồi trên xe (NNTX)
                </Label>
              </div>

              {/* NNTX Conditional inputs */}
              {hasNntx ? (
                <>
                  <div className="col-span-1 md:col-span-6">
                    <Field label="Số chỗ mua NNTX" name="passengerCount" type="number" required defaultValue={seatCount} />
                  </div>
                  <div className="col-span-1 md:col-span-6 space-y-1">
                    <Label htmlFor="passengerFee">Phí bảo hiểm/ 1 chỗ ngồi (NNTX)</Label>
                    <Select id="passengerFee" name="passengerFee" required defaultValue={20000}>
                      {passengerFees.map((f) => (
                        <option key={f} value={f}>{f.toLocaleString("vi-VN")}đ</option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <input type="hidden" name="passengerCount" value={0} />
                  <input type="hidden" name="passengerFee" value={0} />
                </>
              )}

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
