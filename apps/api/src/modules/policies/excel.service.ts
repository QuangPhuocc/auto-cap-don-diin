import xlsx from "xlsx";
import { AppError } from "../../lib/errors.js";

export const DIIN_EXCEL_HEADERS = [
  "BIỂN SỐ", "LOẠI XE", "SỐ CHỔ", "HỌ TÊN CHỦ XE", "SỐ KHUNG", "SỐ MÁY",
  "SỐ HÀNH KHÁCH ĐƯỢC BẢO HIỂM", "PHÍ BẢO HIỂM/ 1 CHỔ NGỒI", "SỐ ĐIỆN THOẠI NHẬN GCN",
  "EMAIL", "ĐỊA CHỈ", "GIỚI TÍNH", "NGÀY BẮT ĐẦU HIỆU LỰC", "GIỜ", "PHÚT",
  "SỐ NĂM BẢO HIỂM", "LOẠI PHÔI", "SỐ PHÔI"
];

const normalize = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export function inspectExcel(filePath: string) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new AppError(422, "File Excel không có worksheet");
  const rows = xlsx.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
  if (!rows.length) throw new AppError(422, "File Excel trống");
  const headers = (rows[0] as unknown[]).map(normalize);
  const missing = DIIN_EXCEL_HEADERS.filter((header) => !headers.includes(normalize(header)));
  if (missing.length) throw new AppError(422, `File Excel sai mẫu. Thiếu cột: ${missing.join(", ")}`, "INVALID_EXCEL_TEMPLATE");
  const dataRows = rows.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""));
  if (!dataRows.length) throw new AppError(422, "File Excel không có dòng dữ liệu");
  if (dataRows.length > 100) throw new AppError(422, "DIIN chỉ khuyến nghị tối đa 100 dòng mỗi file");
  return { rowCount: dataRows.length, headers };
}
