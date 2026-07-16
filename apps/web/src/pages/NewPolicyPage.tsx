import { Send } from "lucide-react";
import { FormEvent, useState, useEffect, useRef, InputHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
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
  error,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-2">
    <Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} className={error ? "border-red-500 focus-visible:ring-red-500" : ""} {...props} />
    {error && <p className="text-xs text-red-500 font-medium animate-fadeIn">{error}</p>}
  </div>
);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccess, setOcrSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter") {
      dragCounter.current++;
      setDragActive(true);
    } else if (e.type === "dragleave") {
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setDragActive(false);
      }
    } else if (e.type === "dragover") {
      // Must prevent default to allow drop
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;
    
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

  interface IssuerUser {
    id: string;
    fullName: string;
    phone: string | null;
    username: string;
  }
  const [issuers, setIssuers] = useState<IssuerUser[]>([]);
  const [issuerMode, setIssuerMode] = useState<"select" | "custom">("select");
  const [selectedIssuerId, setSelectedIssuerId] = useState<string>("");
  const [customIssuer, setCustomIssuer] = useState<string>("");

  useEffect(() => {
    api<IssuerUser[]>("/users/issuers")
      .then((res) => {
        setIssuers(res);
        if (user && res.length > 0) {
          const matched = res.find((u) => u.id === user.id);
          if (matched) {
            setSelectedIssuerId(matched.id);
            setIssuerMode("select");
          } else {
            const defaultIssuers = ["PHƯỚC", "LINH", "NHI", "DIỄM", "YÊN", "DUY THƯƠNG"];
            const isDefaultName = defaultIssuers.includes(user.fullName.toUpperCase());
            if (isDefaultName) {
              const fallbackMatched = res.find(u => defaultIssuers.includes(u.fullName.toUpperCase()));
              if (fallbackMatched) {
                setSelectedIssuerId(fallbackMatched.id);
                setIssuerMode("select");
                return;
              }
            }
            setIssuerMode("custom");
            setCustomIssuer(user.fullName);
          }
        }
      })
      .catch((err) => console.error("Failed to load issuers:", err));
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    const f = new FormData(form);
    const body = Object.fromEntries(f.entries());

    // Validate agent & phone: if user is special, and agent is empty, phone is required
    const specialUsernames = ["0962731468", "0906643381", "0942542249", "0981740680", "0931183389"];
    const specialFullNames = ["LINH", "PHƯỚC", "YÊN", "DIỄM", "NHI"];
    const isSpecialAccount = user && (
      specialUsernames.includes(user.username) || 
      specialFullNames.includes(user.fullName.toUpperCase())
    );

    const errors: Record<string, string> = {};

    if (isSpecialAccount) {
      const agent = String(body.agent || "").trim();
      const phone = String(body.phone || "").trim();
      if (!agent && !phone) {
        errors.phone = "Vui lòng nhập Số điện thoại hoặc Đại lý";
        errors.agent = "Vui lòng nhập Số điện thoại hoặc Đại lý";
      }
    }

    // Validate NNTX <= seatCount
    const seat = Number(body.seatCount || 0);
    const passenger = Number(body.passengerCount || 0);
    if (passenger > seat) {
      errors.passengerCount = "Số chỗ mua NNTX lớn hơn Số chỗ ngồi trên xe";
    }

    // Validate plate and chassis/engine constraints
    const plate = String(body.plateNumber || "").trim();
    const chassis = String(body.chassisNumber || "").trim();
    const engine = String(body.engineNumber || "").trim();

    const hasPlate = plate !== "" && plate !== "0";
    const hasChassis = chassis !== "" && chassis !== "0";
    const hasEngine = engine !== "" && engine !== "0";

    if (!hasPlate && !(hasChassis && hasEngine)) {
      errors.plateNumber = "Vui lòng cung cấp Biển số xe hoặc cặp Số khung + Số máy";
      errors.chassisNumber = "Vui lòng cung cấp Biển số xe hoặc cặp Số khung + Số máy";
      errors.engineNumber = "Vui lòng cung cấp Biển số xe hoặc cặp Số khung + Số máy";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessage({
        ok: false,
        text: "Vui lòng bổ sung đầy đủ thông tin bị lỗi bên dưới"
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
      setMessage({ ok: true, text: "Đã tạo đơn và gửi phát hành thành công" });
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
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === "VALIDATION_ERROR") {
        const fieldErrorsData = err.data?.errors?.fieldErrors || {};
        const mappedErrors: Record<string, string> = {};
        for (const key of Object.keys(fieldErrorsData)) {
          mappedErrors[key] = fieldErrorsData[key]?.[0] || "Thông tin không hợp lệ";
        }
        setFieldErrors(mappedErrors);
        setMessage({
          ok: false,
          text: err.message || "Dữ liệu nhập không hợp lệ"
        });
      } else {
        setMessage({
          ok: false,
          text: err instanceof Error ? err.message : "Không tạo được đơn"
        });
      }
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div 
      className="mx-auto max-w-4xl pt-4 relative min-h-[400px]"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* Fullscreen style drag-drop overlay */}
      {dragActive && (
        <div 
          className="absolute inset-0 z-50 bg-white/50 rounded-xl border-2 border-dashed border-orange-400 pointer-events-none"
        />
      )}

      <div className="mb-4">
        <h2 className="text-2xl font-bold text-stone-800">Tạo đơn Bảo hiểm BB TNDS hãng VASS Viễn Đông</h2>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <Card className="transition-all duration-300">
          <CardHeader className="flex flex-row items-center space-y-0 pb-4 border-b">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full">
              
              {/* Nút OCR – desktop: text dài, mobile: gọn */}
              <label 
                htmlFor="ocr-file-upload" 
                className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-1.5 h-9 md:h-10 border border-dashed border-orange-300 hover:border-orange-400 bg-orange-50/20 hover:bg-orange-50/50 rounded-md text-xs font-bold text-orange-600 cursor-pointer shadow-sm transition-all duration-200 ${
                  ocrLoading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {ocrLoading ? (
                  <span className="truncate">Đang quét tài liệu...</span>
                ) : (
                  <>
                    <span className="md:hidden whitespace-nowrap">Tải ảnh/PDF</span>
                    <span className="hidden md:inline truncate">Tải lên hoặc kéo thả Đăng ký, đăng kiểm, bảo hiểm cũ, file bảo hiểm, hoá đơn vào đây</span>
                  </>
                )}
                <input 
                  type="file" 
                  id="ocr-file-upload" 
                  className="hidden" 
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  onChange={handleFileChange}
                  disabled={ocrLoading}
                />
              </label>

              <Link to="/policies" className="relative shrink-0">
                <Button 
                  type="button" 
                  variant={hasNewPolicy ? "default" : "outline"} 
                  onClick={() => {
                    setHasNewPolicy(false);
                    localStorage.setItem("hasNewPolicy", "false");
                  }}
                  className={`px-3 md:px-4 py-1.5 md:py-2 h-9 md:h-10 relative flex items-center gap-1.5 text-xs md:text-sm transition-all duration-300 ${
                    hasNewPolicy 
                      ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md shadow-blue-100 animate-pulse scale-[1.03]" 
                      : ""
                  }`}
                >
                  Danh sách đơn
                  {hasNewPolicy && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                  )}
                </Button>
              </Link>
              <Button type="submit" disabled={busy} className="px-3 md:px-6 py-1.5 md:py-2 h-9 md:h-10 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm shrink-0 ml-auto">
                <Send size={14} />
                {busy ? "Đang gửi..." : "Phát hành"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Ẩn Giới tính (mặc định NAM) và Email (mặc định qphuocins@gmail.com) */}
            <input type="hidden" name="gender" value="NAM" />
            <input type="hidden" name="email" value="qphuocins@gmail.com" />

            {message && (
              <div className={`rounded-lg p-3 text-sm font-medium border animate-fadeIn ${message.ok ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                {message.text}
              </div>
            )}

            {/* OCR Status/Result Alerts */}
            {(ocrLoading || ocrSuccess || ocrError) && (
              <div className="space-y-2">
                {ocrLoading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 p-2.5 rounded-lg animate-pulse justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    Đang nhận diện tài liệu và tự động điền form...
                  </div>
                )}
                {ocrSuccess && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg animate-fadeIn">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {ocrSuccess}
                  </div>
                )}
                {ocrError && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg animate-fadeIn">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {ocrError}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-6">
              
              {/* Dòng 1: Cấu hình động theo tài khoản */}
              {isSpecialUser ? (
                <>
                  {issuerMode === "select" ? (
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="issuerSelect">Người cấp</Label>
                      <Select
                        id="issuerSelect"
                        value={selectedIssuerId}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIssuerMode("custom");
                          } else {
                            setSelectedIssuerId(e.target.value);
                          }
                        }}
                      >
                        {issuers.map((iss) => (
                          <option key={iss.id} value={iss.id}>
                            {iss.fullName} {iss.phone || iss.username ? ` - ${iss.phone || iss.username}` : ""}
                          </option>
                        ))}
                        <option value="__custom__">✍️ Gõ tên khác...</option>
                      </Select>
                      <input type="hidden" name="revenueUserId" value={selectedIssuerId} />
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
                    <Field label="Đại lý" name="agent" required={false} error={fieldErrors.agent} />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} value={phone} onChange={(e) => setPhone(e.target.value)} error={fieldErrors.phone} />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-3">
                    <Field label="Đại lý" name="agent" required={false} error={fieldErrors.agent} />
                  </div>
                  <div className="md:col-span-3">
                    <Field label="Số điện thoại nhận GCN" name="phone" required={false} value={phone} onChange={(e) => setPhone(e.target.value)} error={fieldErrors.phone} />
                  </div>
                </>
              )}

              {/* Dòng 2: Họ tên chủ xe - Địa chỉ trên đăng ký */}
              <div className="md:col-span-3">
                <Field label="Họ tên chủ xe" name="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} error={fieldErrors.customerName} />
              </div>
              <div className="md:col-span-3">
                <Field label="Địa chỉ trên đăng ký" name="address" value={address} onChange={(e) => setAddress(e.target.value)} error={fieldErrors.address} />
              </div>

              {/* Dòng 3: Biển số - Số khung - Số máy */}
              <div className="md:col-span-2">
                <Field
                  label="Biển số"
                  name="plateNumber"
                  required={false}
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(restoreTelexAndUppercase(e.target.value))}
                  onBlur={(e) => {
                    setPlateNumber(formatPlateNumber(e.target.value));
                  }}
                  error={fieldErrors.plateNumber}
                />
              </div>
              <div className="md:col-span-2">
                <Field
                  label="Số khung"
                  name="chassisNumber"
                  required={false}
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(restoreTelexAndUppercase(e.target.value))}
                  error={fieldErrors.chassisNumber}
                />
              </div>
              <div className="md:col-span-2">
                <Field
                  label="Số máy"
                  name="engineNumber"
                  required={false}
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(restoreTelexAndUppercase(e.target.value))}
                  error={fieldErrors.engineNumber}
                />
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
                <Field label="Số chỗ ngồi" name="seatCount" type="number" required value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))} error={fieldErrors.seatCount} />
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
                <Field label="Số chỗ mua NNTX" name="passengerCount" type="number" required defaultValue={0} error={fieldErrors.passengerCount} />
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

          </CardContent>
        </Card>
      </form>
    </div>
  );
}
