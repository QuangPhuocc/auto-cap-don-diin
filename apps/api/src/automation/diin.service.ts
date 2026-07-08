import fs from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { diinPool, submitMutex } from "./diin.pool.js";
import { diinSelectors } from "./diin.selectors.js";
import type { IssuedPolicyResult, SinglePolicyRecord } from "./diin.types.js";

/**
 * DiinService — Xử lý 1 job phát hành trên 1 tab (Page) riêng biệt.
 *
 * Khởi tạo bằng cách gọi DiinService.create() để lấy tab từ pool.
 * Sau khi xong phải gọi close() để đóng tab.
 *
 * Không tự quản lý Browser/Context — được inject từ DiinBrowserPool.
 */
export class DiinService {
  private page: Page;
  private jobId?: string;

  private constructor(page: Page, jobId?: string) {
    this.page = page;
    this.jobId = jobId;
  }

  /** Factory — lấy 1 tab mới từ pool */
  static async create(jobId?: string): Promise<DiinService> {
    const page = await diinPool.acquirePage();
    return new DiinService(page, jobId);
  }

  /** Đóng tab sau khi xong */
  async close(): Promise<void> {
    try {
      await this.page.close();
    } catch {
      // Bỏ qua lỗi khi đóng tab
    }
  }

  /** Chụp screenshot — dùng khi debug */
  async captureScreenshot(outputPath: string): Promise<void> {
    try {
      await this.page.screenshot({ path: outputPath, fullPage: true });
    } catch {
      // Bỏ qua lỗi screenshot
    }
  }

  private assertIssueAllowed() {
    if (!env.DIIN_ALLOW_ISSUE) {
      throw new AppError(503, "Chế độ phát hành DIIN đang bị khóa an toàn (DIIN_ALLOW_ISSUE=false)", "DIIN_ISSUE_DISABLED");
    }
  }

  /**
   * Kiểm tra session DIIN còn hợp lệ không.
   * Nếu bị redirect về login → re-login qua pool.
   */
  private async ensureSession(currentUrl: string): Promise<boolean> {
    const url = currentUrl.toLowerCase();
    const isLoginPage = url.includes("/login") || url.includes("/signin") || url.includes("/account/login");
    if (isLoginPage) {
      console.log(`[DIIN:${this.jobId}] Session hết hạn — yêu cầu re-login qua pool...`);
      await diinPool.relogin();
      return true; // Đã re-login
    }
    return false;
  }

  private async firstExisting(selectors: readonly string[]): Promise<Locator> {
    for (const selector of selectors) {
      const locator = this.page.locator(selector).first();
      if (await locator.count().catch(() => 0)) return locator;
    }
    throw new AppError(502, `Không tìm thấy phần tử DIIN: ${selectors.join(" | ")}`, "DIIN_SELECTOR_NOT_FOUND");
  }

  private async controlForLabel(label: string, kind: "input" | "select" | "textarea" = "input"): Promise<Locator> {
    const page = this.page;
    const byLabel = page.getByLabel(label, { exact: false }).first();
    if (await byLabel.count()) return byLabel;
    const labelNode = page.locator("label", { hasText: label }).first();
    if (await labelNode.count()) {
      const forId = await labelNode.getAttribute("for");
      if (forId) return page.locator(`[id=${JSON.stringify(forId)}]`);
      const sibling = labelNode.locator(`xpath=following-sibling::${kind}[1]`);
      if (await sibling.count()) return sibling;
      const container = labelNode.locator("xpath=parent::*").locator(kind).first();
      if (await container.count()) return container;
    }
    throw new AppError(502, `Không tìm thấy trường '${label}' trên DIIN`, "DIIN_FIELD_NOT_FOUND");
  }

  private async fill(label: string, value: string | null | undefined): Promise<void> {
    if (value == null || value === "") return;
    await (await this.controlForLabel(label)).fill(String(value));
  }

  private async choose(label: string, text: string | null | undefined): Promise<void> {
    if (!text) return;
    const control = await this.controlForLabel(label, "select");
    if ((await control.evaluate((el) => el.tagName)) === "SELECT") {
      await control.selectOption({ label: text });
    } else {
      await control.click();
      await this.page.getByText(text, { exact: true }).last().click();
    }
  }

  /**
   * Phát hành 1 đơn đơn lẻ.
   *
   * Sau khi submit thành công, ưu tiên đọc GCN từ trang kết quả (không dùng list search)
   * để tránh nhầm lẫn khi nhiều job cùng biển số chạy song song.
   */
  async issueSingle(policy: SinglePolicyRecord, policyId?: string): Promise<IssuedPolicyResult> {
    this.assertIssueAllowed();
    const page = this.page;

    // Điều hướng đến trang tạo mới
    await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.issuedCarsCreate}`, {
      waitUntil: "domcontentloaded"
    });
    // Đợi form sẵn sàng
    await page.locator("#Fullname").waitFor({ state: "visible", timeout: 20000 });

    // ── Điền thông tin ──────────────────────────────────────────────
    await page.locator("#Fullname").fill(policy.customerName);

    if (policy.phone) {
      await page.locator("#Phone").fill(policy.phone);
    }
    if (policy.address) {
      await page.locator("#Address").fill(policy.address);
    }
    if (policy.vehicleType) {
      await page.locator("#AutomobilesFullTypeName").selectOption({ label: policy.vehicleType });
    }
    if (policy.seatCount) {
      await page.locator("#Attributes_Seat").fill(String(policy.seatCount));
    }

    // Biển số: KHÔNG điền nếu null/undefined/empty/"0"
    const hasPlate = policy.plateNumber && policy.plateNumber !== "0" && policy.plateNumber.trim() !== "";
    if (hasPlate) {
      await page.locator("#LicensePlates").fill(policy.plateNumber);
    }

    if (policy.gender) {
      const genderVal = policy.gender === "NỮ" ? "0" : "1";
      await page.locator("#Gender").selectOption(genderVal);
    }

    await page.locator("#PassengerCount").fill(String(policy.passengerCount ?? 0));

    if (policy.passengerFee !== undefined && policy.passengerFee !== null) {
      await page.locator("#PassengerFee").selectOption(String(policy.passengerFee));
    }
    if (policy.email) {
      await page.locator("#Email").fill(policy.email);
    }
    if (policy.chassisNumber != null && policy.chassisNumber !== "" && policy.chassisNumber !== "0") {
      await page.locator("#ChassisNumber").fill(policy.chassisNumber);
    }
    if (policy.engineNumber != null && policy.engineNumber !== "" && policy.engineNumber !== "0") {
      await page.locator("#MachineNumber").fill(policy.engineNumber);
    }

    // Thời gian hiệu lực — tự động đẩy lên hiện tại nếu quá khứ
    let effDate = policy.effectiveDate ? new Date(policy.effectiveDate) : new Date();
    const now = new Date();
    if (effDate.getTime() < now.getTime()) {
      effDate = new Date(now.getTime() + 2 * 60 * 1000);
    }
    await page.locator("#EffectiveDate").fill(this.formatDate(effDate));
    await page.locator("#NumberYearInsure").fill(String(policy.insuranceYears ?? 1));

    if (policy.agent) {
      await page.locator("#AgentName").fill(policy.agent);
    }

    // ── Submit ──────────────────────────────────────────────────────
    const release = await submitMutex.acquire();
    try {
      const submissionTime = new Date();
      await page.locator("#btn-submit").click();

      // Đợi trang chuyển trạng thái: URL thay đổi HOẶC popup lỗi xuất hiện
      await Promise.race([
        page.waitForURL((url) => !url.toString().toUpperCase().includes("/CREATE"), { timeout: env.DIIN_TIMEOUT_MS }),
        page.waitForSelector(".swal2-popup, .validation-summary-errors, .alert-danger, #error-msg", { timeout: env.DIIN_TIMEOUT_MS })
      ]).catch(() => {/* timeout — kiểm tra URL bên dưới */});

      // Xử lý popup SweetAlert2 nếu có
      const swalConfirm = page.locator(".swal2-confirm");
      if (await swalConfirm.isVisible({ timeout: 1500 }).catch(() => false)) {
        await swalConfirm.click();
        await page.waitForTimeout(1000);
      }

      const currentUrl = page.url();

      // Kiểm tra session hết hạn
      if (await this.ensureSession(currentUrl)) {
        throw new AppError(502, "Session DIIN hết hạn giữa chừng. Vui lòng thử lại.", "DIIN_SESSION_EXPIRED");
      }

      // Còn ở trang Create → DIIN báo lỗi validation
      if (currentUrl.toUpperCase().includes("/CREATE")) {
        const errorText = await this.extractPageErrors();
        throw new AppError(502, `Cổng DIIN báo lỗi: ${errorText}`, "DIIN_VALIDATION_FAILED");
      }

      // ── Đọc GCN từ danh sách sau khi submit ─────────────────────────
      // Thêm 4s chờ DIIN sinh số ấn chỉ
      await page.waitForTimeout(4000);

      console.log(`[DIIN:${this.jobId}] Đang quét GCN từ danh sách...`);
      return await this.collectByPlate(policy, submissionTime, policyId);
    } finally {
      release();
    }
  }

  /**
   * Tìm GCN trong danh sách DIIN — chỉ dùng làm fallback.
   *
   * Cải tiến so với phiên bản cũ:
   * - Phân biệt chính xác khi nhiều người phát hành trùng biển số song song
   * - Khớp cả Biển số / Số khung / Số máy + Tên khách hàng (không dấu, viết liền)
   * - Window thời gian thu hẹp còn 30 giây (thay vì 90s)
   */
  private async collectByPlate(
    policy: SinglePolicyRecord,
    submissionTime: Date,
    policyId?: string
  ): Promise<IssuedPolicyResult> {
    const page = this.page;
    const plateNumber = policy.plateNumber;
    const fallbackName = policy.customerName;

    let certificateNumber: string | undefined;
    let premium: number | undefined;
    let matchedRow: Locator | undefined;
    let cells: string[] = [];

    const cleanNum = (str: string | null | undefined) => {
      if (!str) return "";
      return str.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
    };

    const cleanName = (str: string | null | undefined) => {
      if (!str) return "";
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .trim();
    };

    const targetPlate = cleanNum(plateNumber);
    const hasPlate = targetPlate && targetPlate !== "0";

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.issuedCars}`, { waitUntil: "domcontentloaded" });

      const search = page.locator("#search");
      if (await search.count()) {
        const queryTerm = (!plateNumber || plateNumber === "0") ? fallbackName : plateNumber;
        await search.fill(queryTerm);
        await search.press("Enter");
        await page.waitForTimeout(2000);
      }

      await page.locator("tr.jqgrow").first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

      const rows = page.locator("tr.jqgrow");
      const count = await rows.count();

      for (let i = 0; i < count; i++) {
        const r = rows.nth(i);
        const rowCells = (await r.locator("td").allInnerTexts()).map(x => x.trim());

        // 1. Kiểm tra khớp biển số hoặc số khung/máy
        let isVehicleMatch = false;
        if (hasPlate) {
          isVehicleMatch = rowCells.some(cell => cleanNum(cell) === targetPlate);
        } else {
          const targetChassis = cleanNum(policy.chassisNumber);
          const targetEngine = cleanNum(policy.engineNumber);
          isVehicleMatch = rowCells.some(cell => {
            const cellClean = cleanNum(cell);
            return (targetChassis && cellClean === targetChassis) || (targetEngine && cellClean === targetEngine);
          });
        }

        if (!isVehicleMatch) continue;

        // 2. Kiểm tra khớp tên khách hàng
        const targetName = cleanName(fallbackName);
        const isNameMatch = rowCells.some(cell => {
          const cellClean = cleanName(cell);
          return cellClean.includes(targetName) || targetName.includes(cellClean);
        });

        if (!isNameMatch) continue;

        // 3. Khớp thời gian: trong vòng 30 giây kể từ lúc submit
        const dateCell = rowCells.find(x => /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(x));
        if (dateCell) {
          const diinDate = this.parseDiinDate(dateCell);
          if (diinDate) {
            const diffMs = Math.abs(diinDate.getTime() - submissionTime.getTime());
            if (diffMs > 30000) continue; // Ngoài cửa sổ 30 giây → bỏ qua
          }
        }

        matchedRow = r;
        cells = rowCells;
        break;
      }

      if (matchedRow) {
        certificateNumber = cells.find(x => /D?\d{2}-\d{2}-\d{5,8}-\d+/i.test(x));
        if (certificateNumber) {
          // cells[13] là Tổng Phí. Ta cũng lọc tất cả các cột số để lấy số lớn nhất làm dự phòng (fallback)
          const parsedAmounts = cells
            .map(c => this.parseMoney(c))
            .filter((n): n is number => n !== undefined && n >= 10000);
          premium = this.parseMoney(cells[13]) || (parsedAmounts.length > 0 ? Math.max(...parsedAmounts) : undefined);
          break;
        } else {
          matchedRow = undefined;
        }
      }

      if (attempt < maxAttempts - 1) {
        console.log(`[DIIN:${this.jobId}] Thử lại lần ${attempt + 2}/${maxAttempts} sau 3 giây...`);
        await page.waitForTimeout(3000);
      }
    }

    if (!matchedRow) {
      console.warn(`[DIIN:${this.jobId}] Không tìm thấy GCN trong danh sách cho: ${plateNumber}. ` +
        `Đơn đã phát hành thành công trên DIIN nhưng chưa thu thập được số GCN.`);
      return { plateNumber, customerName: fallbackName };
    }

    const result: IssuedPolicyResult = { plateNumber, customerName: fallbackName, certificateNumber, premium };
    const certCapture = await this.captureCertificate(matchedRow, certificateNumber ?? plateNumber, policyId);
    return { ...result, ...certCapture };
  }

  private async extractPageErrors(): Promise<string> {
    const page = this.page;
    const selectors = [
      ".validation-summary-errors",
      ".field-validation-error",
      ".alert-danger",
      ".error-message",
      ".swal2-html-container",
      ".swal2-title",
      "#error-msg",
      ".alert",
      ".error"
    ];
    for (const sel of selectors) {
      const el = page.locator(sel);
      if (await el.count() > 0) {
        const texts = await el.allInnerTexts();
        const text = texts.map(t => t.trim()).filter(Boolean).join("; ");
        if (text) return text;
      }
    }
    return "Không thể lưu đơn hàng. Có lỗi xảy ra hoặc thiếu thông tin bắt buộc trên cổng DIIN.";
  }

  private async captureCertificate(row: Locator, fileStem: string, policyId?: string): Promise<Partial<IssuedPolicyResult>> {
    const gcn = row.getByText(diinSelectors.buttons.certificate).first();
    let pdfUrl: string | undefined;

    if (await gcn.count()) {
      const onclick = await gcn.getAttribute("onclick");
      const match = onclick?.match(/window\.open\(['\"](.*?)['"]\)/);
      pdfUrl = match ? match[1] : undefined;
    }

    if (!pdfUrl && fileStem && /D?\d{2}-\d{2}-\d{6}-\d+/i.test(fileStem)) {
      pdfUrl = this.buildVngPdfUrl(fileStem);
    }

    if (!pdfUrl) return {};

    this.downloadPdfInBackground(pdfUrl, fileStem, policyId);
    return { pdfUrl };
  }

  /** Dựng URL PDF chuẩn từ VNG Cloud */
  private buildVngPdfUrl(fileStem: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `https://hcm03.vstorage.vngcloud.vn/v1/AUTH_7292c955a56f49b890a5d5b28309503c/daily-diin-production/${year}/${month}/${day}/_${fileStem}.pdf`;
  }

  /** Download PDF về server trong background (không block luồng chính) */
  private downloadPdfInBackground(pdfUrl: string, fileStem: string, policyId?: string): void {
    const safeName = fileStem.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Dùng policyId làm prefix để tránh ghi đè khi cùng biển số
    const filename = policyId ? `${policyId.slice(0, 8)}_${safeName}.pdf` : `${safeName}.pdf`;
    const pdfPath = path.resolve(env.PDF_DIR, filename);

    (async () => {
      try {
        await fs.mkdir(env.PDF_DIR, { recursive: true });
        let response = await fetch(pdfUrl);
        for (let attempt = 0; attempt < 8 && !response.ok; attempt++) {
          console.log(`[bg] Chờ PDF sẵn sàng trên VNG Cloud, lần ${attempt + 1}/8...`);
          await new Promise(r => setTimeout(r, 4000));
          response = await fetch(pdfUrl);
        }
        if (!response.ok) {
          console.error(`[bg] PDF không khả dụng sau 8 lần thử: ${pdfUrl}`);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Kiểm tra magic bytes — phải là PDF thật
        const magic = buffer.slice(0, 4).toString("ascii");
        if (magic !== "%PDF") {
          console.error(`[bg] File tải về không phải PDF (magic: ${magic}) — bỏ qua`);
          return;
        }
        if (buffer.length < 1024) {
          console.error(`[bg] File PDF quá nhỏ (${buffer.length} bytes) — bỏ qua`);
          return;
        }

        await fs.writeFile(pdfPath, buffer);
        console.log(`[bg] PDF đã lưu: ${pdfPath}`);

        if (policyId) {
          await prisma.policy.update({
            where: { id: policyId },
            data: { pdfPath }
          });
          console.log(`[bg] Đã cập nhật pdfPath cho policy: ${policyId}`);
        }
      } catch (err) {
        console.error("[bg] Lỗi download PDF:", err);
      }
    })();
  }

  private formatDate(date: Date): string {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day = String(vnTime.getUTCDate()).padStart(2, "0");
    const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
    const year = vnTime.getUTCFullYear();
    const hours = String(vnTime.getUTCHours()).padStart(2, "0");
    const minutes = String(vnTime.getUTCMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private parseMoney(value?: string): number | undefined {
    return value ? Number(value.replace(/\./g, "").replace(/,/g, ".")) || undefined : undefined;
  }

  private parseDiinDate(dateStr: string): Date | null {
    const cleanStr = dateStr.toUpperCase().replace(/\s+/g, " ");
    const match = cleanStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+(SÁNG|CHIỀU|AM|PM))?/);
    if (!match) return null;
    const [, day, month, year, hour, minute, second, period] = match;
    let h = parseInt(hour, 10);
    if (period === "CHIỀU" || period === "PM") { if (h < 12) h += 12; }
    else if (period === "SÁNG" || period === "AM") { if (h === 12) h = 0; }
    // Giờ DIIN là UTC+7, convert sang UTC
    const utcMs = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minute), second ? parseInt(second) : 0);
    return new Date(utcMs - 7 * 60 * 60 * 1000);
  }
}
