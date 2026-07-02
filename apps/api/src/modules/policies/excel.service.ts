import xlsx from "xlsx";
import { AppError } from "../../lib/errors.js";
import { restoreTelexAndUppercase } from "../../lib/text.js";

export const DIIN_EXCEL_HEADERS = [
  "BIỂN SỐ", "LOẠI XE", "SỐ CHỔ", "HỌ TÊN CHỦ XE", "SỐ KHUNG", "SỐ MÁY",
  "SỐ HÀNH KHÁCH ĐƯỢC BẢO HIỂM", "PHÍ BẢO HIỂM/ 1 CHỔ NGỒI", "SỐ ĐIỆN THOẠI NHẬN GCN",
  "EMAIL", "ĐỊA CHỈ", "GIỚI TÍNH", "NGÀY BẮT ĐẦU HIỆU LỰC", "GIỜ", "PHÚT",
  "SỐ NĂM BẢO HIỂM", "LOẠI PHÔI", "SỐ PHÔI", "ĐẠI LÝ"
];

export function cleanExcelFile(filePath: string) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;
  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (!rows.length) return;

  const headers = (rows[0] as unknown[]).map(h => String(h || "").trim().toUpperCase().replace(/\s+/g, " "));
  const chassisIdx = headers.indexOf("SỐ KHUNG");
  const engineIdx = headers.indexOf("SỐ MÁY");
  const plateIdx = headers.indexOf("BIỂN SỐ");

  let modified = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row) continue;

    if (chassisIdx !== -1 && row[chassisIdx] !== undefined && row[chassisIdx] !== null) {
      const original = String(row[chassisIdx]);
      const cleaned = restoreTelexAndUppercase(original).trim().toUpperCase();
      if (original !== cleaned) {
        row[chassisIdx] = cleaned;
        modified = true;
      }
    }

    if (engineIdx !== -1 && row[engineIdx] !== undefined && row[engineIdx] !== null) {
      const original = String(row[engineIdx]);
      const cleaned = restoreTelexAndUppercase(original).trim().toUpperCase();
      if (original !== cleaned) {
        row[engineIdx] = cleaned;
        modified = true;
      }
    }

    if (plateIdx !== -1 && row[plateIdx] !== undefined && row[plateIdx] !== null) {
      const original = String(row[plateIdx]);
      const cleaned = restoreTelexAndUppercase(original).trim().toUpperCase();
      if (original !== cleaned) {
        row[plateIdx] = cleaned;
        modified = true;
      }
    }
  }

  if (modified) {
    const newSheet = xlsx.utils.aoa_to_sheet(rows);
    workbook.Sheets[sheetName] = newSheet;
    xlsx.writeFile(workbook, filePath);
  }
}

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
