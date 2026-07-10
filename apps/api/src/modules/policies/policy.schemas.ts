import { z } from "zod";
import { restoreTelexAndUppercase, formatPlateNumber } from "../../lib/text.js";

export const singlePolicySchema = z.object({
  customerName: z.string().min(2, "Tên khách hàng tối thiểu 2 ký tự").max(255),
  phone: z.preprocess((val) => {
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) return "000";
    return val;
  }, z.string().regex(/^(000|(0|\+84)[35789][0-9]{8})$/, "Số điện thoại không đúng định dạng (10 chữ số hoặc 000)")),
  address: z.string().min(2, "Địa chỉ tối thiểu 2 ký tự").max(1000),
  plateNumber: z.preprocess((val) => {
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) return "0";
    return val;
  }, z.string().min(1).max(50).transform((v) => {
    if (v === "0") return "0";
    return formatPlateNumber(restoreTelexAndUppercase(v));
  })),
  chassisNumber: z.preprocess((val) => {
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) return "0";
    return val;
  }, z.string().min(1).max(100).transform((v) => {
    if (v === "0") return "0";
    return restoreTelexAndUppercase(v).trim().toUpperCase();
  })).refine((v) => v === "0" || /^[A-Z0-9]{5,50}$/.test(v), "Số khung phải từ 5-50 ký tự chữ và số"),
  engineNumber: z.preprocess((val) => {
    if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) return "0";
    return val;
  }, z.string().min(1).max(100).transform((v) => {
    if (v === "0") return "0";
    return restoreTelexAndUppercase(v).trim().toUpperCase();
  })).refine((v) => v === "0" || /^[A-Z0-9]{3,50}$/.test(v), "Số máy phải từ 3-50 ký tự chữ và số"),
  vehicleType: z.string().min(2, "Vui lòng chọn loại xe").max(255),
  seatCount: z.coerce.number().int().min(1, "Số chỗ tối thiểu là 1").max(100, "Số chỗ tối đa là 100").optional(),
  effectiveDate: z.coerce.date(),
  gender: z.enum(["NAM", "NỮ"]).default("NAM"),
  passengerCount: z.coerce.number().int().min(0, "Số người mua NNTX không được âm").max(100).default(0),
  passengerFee: z.coerce.number().int().min(0).default(0),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  agent: z.string().optional().nullable(),
  issuerName: z.string().optional().nullable(),
  insuranceYears: z.coerce.number().int().min(1).max(3).default(1)
}).refine((data) => {
  const seat = data.seatCount ?? 0;
  const passenger = data.passengerCount ?? 0;
  return passenger <= seat;
}, {
  message: "Số chỗ mua NNTX lớn hơn Số chỗ ngồi trên xe",
  path: ["passengerCount"]
}).refine((data) => {
  const plate = data.plateNumber || "0";
  const chassis = data.chassisNumber || "0";
  const engine = data.engineNumber || "0";
  const hasPlate = plate !== "0" && plate !== "";
  const hasChassis = chassis !== "0" && chassis !== "";
  const hasEngine = engine !== "0" && engine !== "";
  return hasPlate || (hasChassis && hasEngine);
}, {
  message: "Vui lòng cung cấp Biển số xe hoặc cặp Số khung + Số máy",
  path: ["plateNumber"]
});

export type SinglePolicyInput = z.infer<typeof singlePolicySchema>;


