import { BatchStatus, JobStatus, PolicyStatus } from "@prisma/client";
import { DiinService } from "../automation/diin.service.js";
import { prisma } from "../lib/prisma.js";
import type { PolicyQueueData } from "../queue/policy.queue.js";
import XLSX from "xlsx";

function parseExcelPolicies(filePath: string): Record<string, any> {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (!rows.length) return {};
  
  const headers = (rows[0] as unknown[]).map(h => String(h || "").trim().toUpperCase().replace(/\s+/g, " "));
  
  const plateIdx = headers.indexOf("BIỂN SỐ");
  const typeIdx = headers.indexOf("LOẠI XE");
  const seatIdx = headers.indexOf("SỐ CHỔ");
  const nameIdx = headers.indexOf("HỌ TÊN CHỦ XE");
  const chassisIdx = headers.indexOf("SỐ KHUNG");
  const engineIdx = headers.indexOf("SỐ MÁY");
  const passengerIdx = headers.indexOf("SỐ HÀNH KHÁCH ĐƯỢC BẢO HIỂM");
  const feeIdx = headers.indexOf("PHÍ BẢO HIỂM/ 1 CHỔ NGỒI");
  const phoneIdx = headers.indexOf("SỐ ĐIỆN THOẠI NHẬN GCN");
  const emailIdx = headers.indexOf("EMAIL");
  const addrIdx = headers.indexOf("ĐỊA CHỈ") !== -1 ? headers.indexOf("ĐỊA CHỈ") : headers.indexOf("ĐẠI CHỈ");
  const genderIdx = headers.indexOf("GIỚI TÍNH");
  const dateIdx = headers.indexOf("NGÀY BẮT ĐẦU HIỆU LỰC");
  const hourIdx = headers.indexOf("GIỜ");
  const minIdx = headers.indexOf("PHÚT");
  const yearsIdx = headers.indexOf("SỐ NĂM BẢO HIỂM");
  const agentIdx = headers.indexOf("ĐẠI LÝ");

  const map: Record<string, any> = {};
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.some(c => String(c ?? "").trim() !== "")) continue;
    
    const rawPlate = String(row[plateIdx] || "").trim();
    if (!rawPlate) continue;
    const plateKey = rawPlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    
    // Parse Date
    let effectiveDate: Date | null = null;
    const rawDate = row[dateIdx];
    if (rawDate instanceof Date) {
      effectiveDate = rawDate;
    } else if (rawDate) {
      const parts = String(rawDate).split(/[-/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        effectiveDate = new Date(year, month, day);
      }
    }
    
    if (effectiveDate) {
      const hour = parseInt(String(row[hourIdx] || "0"), 10);
      const minute = parseInt(String(row[minIdx] || "0"), 10);
      effectiveDate.setHours(hour, minute, 0, 0);
    }
    
    map[plateKey] = {
      customerName: row[nameIdx] ? String(row[nameIdx]).trim() : "",
      phone: row[phoneIdx] ? String(row[phoneIdx]).trim() : null,
      address: row[addrIdx] ? String(row[addrIdx]).trim() : null,
      plateNumber: rawPlate,
      chassisNumber: row[chassisIdx] ? String(row[chassisIdx]).trim() : null,
      engineNumber: row[engineIdx] ? String(row[engineIdx]).trim() : null,
      vehicleType: row[typeIdx] ? String(row[typeIdx]).trim() : null,
      seatCount: row[seatIdx] ? parseInt(row[seatIdx], 10) : null,
      effectiveDate,
      gender: row[genderIdx] ? String(row[genderIdx]).trim().toUpperCase() : "NAM",
      passengerCount: row[passengerIdx] ? parseInt(row[passengerIdx], 10) : 0,
      passengerFee: row[feeIdx] ? parseInt(row[feeIdx], 10) : 0,
      email: row[emailIdx] ? String(row[emailIdx]).trim() : null,
      insuranceYears: row[yearsIdx] ? parseInt(row[yearsIdx], 10) : 1,
      agent: row[agentIdx] ? String(row[agentIdx]).trim() : null,
    };
  }
  
  return map;
}

export async function processPolicyJob(data: PolicyQueueData) {
  await prisma.job.update({
    where: { id: data.dbJobId },
    data: { status: JobStatus.PROCESSING, startedAt: new Date(), attempts: { increment: 1 }, progress: 5 }
  });

  const diin = new DiinService();
  try {
    await diin.start();

    if (data.type === "SINGLE_POLICY") {
      const policy = await prisma.policy.update({
        where: { id: data.policyId },
        data: { status: PolicyStatus.PROCESSING }
      });
      const result = await diin.issueSingle(policy);
      await prisma.policy.update({
        where: { id: policy.id },
        data: { ...result, status: PolicyStatus.ISSUED, issuedAt: new Date() }
      });
    } else {
      const batch = await prisma.batchUpload.update({
        where: { id: data.batchId },
        data: { status: BatchStatus.PROCESSING }
      });

      // Parse the excel file details
      let excelDetailsMap: Record<string, any> = {};
      try {
        excelDetailsMap = parseExcelPolicies(data.filePath);
      } catch (err) {
        console.error("Failed to parse excel details:", err);
      }

      const results = await diin.issueExcel(data.filePath);
      await prisma.$transaction(async (tx) => {
        for (const result of results) {
          const detail = excelDetailsMap[result.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "")] || 
                         excelDetailsMap[result.plateNumber] || {};
          await tx.policy.create({
            data: {
              ...detail,
              ...result,
              userId: batch.userId,
              batchId: batch.id,
              jobId: data.dbJobId,
              status: PolicyStatus.ISSUED,
              issuedAt: new Date()
            }
          });
        }
        await tx.batchUpload.update({
          where: { id: batch.id },
          data: {
            status: BatchStatus.COMPLETED,
            issuedRows: results.length,
            failedRows: Math.max(0, batch.totalRows - results.length)
          }
        });
      });
    }

    await prisma.job.update({
      where: { id: data.dbJobId },
      data: { status: JobStatus.COMPLETED, progress: 100, completedAt: new Date(), error: null }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.job.update({ where: { id: data.dbJobId }, data: { status: JobStatus.FAILED, error: message } });
    if (data.type === "SINGLE_POLICY") {
      await prisma.policy.update({ where: { id: data.policyId }, data: { status: PolicyStatus.FAILED, error: message } });
    } else {
      await prisma.batchUpload.update({ where: { id: data.batchId }, data: { status: BatchStatus.FAILED } });
    }
    throw error;
  } finally {
    await diin.stop();
  }
}
