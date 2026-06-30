import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import * as XLSX from "xlsx";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { diinSelectors } from "./diin.selectors.js";
import type { IssuedPolicyResult, SinglePolicyRecord } from "./diin.types.js";

export class DiinService {
  private browser?: Browser;
  private page?: Page;

  private assertConfigured() {
    if (!env.DIIN_USERNAME || !env.DIIN_PASSWORD) throw new AppError(503, "Chưa cấu hình tài khoản DIIN", "DIIN_NOT_CONFIGURED");
  }

  private assertIssueAllowed() {
    if (!env.DIIN_ALLOW_ISSUE) throw new AppError(503, "Chế độ phát hành DIIN đang bị khóa an toàn (DIIN_ALLOW_ISSUE=false)", "DIIN_ISSUE_DISABLED");
  }

  async start() {
    this.assertConfigured();
    this.browser = await chromium.launch({ headless: env.DIIN_HEADLESS });
    const context = await this.browser.newContext({
      acceptDownloads: true,
      locale: "vi-VN",
      recordVideo: {
        dir: "./videos-production",
        size: { width: 1280, height: 720 }
      }
    });
    this.page = await context.newPage();
    this.page.setDefaultTimeout(env.DIIN_TIMEOUT_MS);
    await this.login();
  }

  async stop() {
    await this.browser?.close();
    this.browser = undefined;
    this.page = undefined;
  }

  async captureScreenshot(outputPath: string) {
    if (this.page) {
      await this.page.screenshot({ path: outputPath, fullPage: true });
    }
  }

  private get activePage() {
    if (!this.page) throw new Error("DIIN browser chưa được khởi tạo");
    return this.page;
  }

  private async firstExisting(selectors: readonly string[]) {
    for (const selector of selectors) {
      const locator = this.activePage.locator(selector).first();
      if (await locator.count().catch(() => 0)) return locator;
    }
    throw new AppError(502, `Không tìm thấy phần tử DIIN: ${selectors.join(" | ")}`, "DIIN_SELECTOR_NOT_FOUND");
  }

  private async login() {
    const page = this.activePage;
    await page.goto(env.DIIN_BASE_URL, { waitUntil: "domcontentloaded" });
    if (await page.getByText(/Bảng kê Bảo hiểm/i).first().isVisible().catch(() => false)) return;
    await (await this.firstExisting(diinSelectors.login.username)).evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, env.DIIN_USERNAME);
    await (await this.firstExisting(diinSelectors.login.password)).evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, env.DIIN_PASSWORD);
    await page.locator("form").first().evaluate((form) => (form as HTMLFormElement).submit());
    const loggedIn = await page
      .locator("a", { hasText: "Bảng kê Bảo hiểm" })
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!loggedIn) {
      throw new AppError(502, "Đăng nhập DIIN thất bại", "DIIN_LOGIN_FAILED");
    }
  }

  private async controlForLabel(label: string, kind: "input" | "select" | "textarea" = "input"): Promise<Locator> {
    const page = this.activePage;
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

  private async fill(label: string, value: string | null | undefined) {
    if (value == null || value === "") return;
    await (await this.controlForLabel(label)).fill(String(value));
  }

  private async choose(label: string, text: string | null | undefined) {
    if (!text) return;
    const control = await this.controlForLabel(label, "select");
    if ((await control.evaluate((el) => el.tagName)) === "SELECT") await control.selectOption({ label: text });
    else {
      await control.click();
      await this.activePage.getByText(text, { exact: true }).last().click();
    }
  }

  private async clickButton(name: RegExp) {
    const page = this.activePage;
    const button = page.getByRole("button", { name }).last();
    if (await button.count()) return button.click();
    const text = page.getByText(name).last();
    if (await text.count()) return text.click();
    throw new AppError(502, `Không tìm thấy nút ${name}`, "DIIN_BUTTON_NOT_FOUND");
  }

  async issueSingle(policy: SinglePolicyRecord): Promise<IssuedPolicyResult> {
    this.assertIssueAllowed();
    const page = this.activePage;
    await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.issuedCarsCreate}`, { waitUntil: "networkidle" });
    await page.locator("#Fullname").fill(policy.customerName);
    if (policy.phone) await page.locator("#Phone").fill(policy.phone);
    if (policy.address) await page.locator("#Address").fill(policy.address);
    if (policy.vehicleType) await page.locator("#AutomobilesFullTypeName").selectOption({ label: policy.vehicleType });
    if (policy.seatCount) await page.locator("#Attributes_Seat").fill(String(policy.seatCount));
    await page.locator("#LicensePlates").fill(policy.plateNumber);
    if (policy.gender) {
      const genderVal = policy.gender === "NỮ" ? "0" : "1";
      await page.locator("#Gender").selectOption(genderVal);
    }
    await page.locator("#PassengerCount").fill(String(policy.passengerCount ?? 0));
    if (policy.passengerFee !== undefined && policy.passengerFee !== null) {
      await page.locator("#PassengerFee").selectOption(String(policy.passengerFee));
    }
    if (policy.email) await page.locator("#Email").fill(policy.email);
    if (policy.chassisNumber) await page.locator("#ChassisNumber").fill(policy.chassisNumber);
    if (policy.engineNumber) await page.locator("#MachineNumber").fill(policy.engineNumber);
    let effDate = policy.effectiveDate ? new Date(policy.effectiveDate) : new Date();
    const now = new Date();
    if (effDate.getTime() < now.getTime()) {
      // Nếu thời gian hiệu lực ở quá khứ do độ trễ hàng đợi, tự động đổi thành thời điểm hiện tại cộng 2 phút cho an toàn
      effDate = new Date(now.getTime() + 2 * 60 * 1000);
    }
    await page.locator("#EffectiveDate").fill(this.formatDate(effDate));
    await page.locator("#NumberYearInsure").fill(String(policy.insuranceYears ?? 1));
    if (policy.agent) {
      await page.locator("#AgentName").fill(policy.agent);
    }
    
    const submissionTime = new Date();
    // Bấm Lưu (Cổng DIIN tự động phát hành thẻ bảo hiểm)
    await page.locator("#btn-submit").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(10000); // Chờ 10s theo yêu cầu
    
    return this.collectByPlate(policy.plateNumber, policy.customerName, submissionTime);
  }

  async issueExcel(filePath: string): Promise<IssuedPolicyResult[]> {
    this.assertIssueAllowed();
    const page = this.activePage;
    await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.insuranceMasterCreate}`, { waitUntil: "networkidle" });
    const business = page.locator("#Type");
    if (await business.count()) {
      const option = business.locator("option", { hasText: /TNDS BB xe OTO/i }).first();
      const value = await option.getAttribute("value").catch(() => null);
      if (value) await business.selectOption(value);
    }
    await page.locator("#ReportFile").setInputFiles(path.resolve(filePath));
    await page.locator("#btn-submit").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // Chờ 3s theo yêu cầu
    
    // Bấm Tính phí ở thanh công cụ bên trái (dùng .w-100 để không kích hoạt nhầm dòng trong bảng)
    const calcBtn = page.locator("button.w-100.ui-button", { hasText: "Tính phí" }).first();
    await calcBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000); // Chờ 3s theo yêu cầu
    
    // Bấm Phát hành ở thanh công cụ bên trái (dùng .w-100 để không kích hoạt nhầm dòng trong bảng)
    const issueBtn = page.locator("button.w-100.ui-button", { hasText: "Phát hành" }).first();
    await issueBtn.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Click Xác nhận phát hành trong modal popup xác nhận (nếu có hiển thị)
    const confirmBtn = page.locator("#btn-phat-hanh").first();
    if (await confirmBtn.count()) {
      const isVisible = await confirmBtn.isVisible().catch(() => false);
      if (isVisible) {
        await confirmBtn.click().catch(() => {});
        await page.waitForLoadState("networkidle");
      }
    }

    // Đọc các biển số và tên khách hàng từ file Excel để đối chiếu
    const workbook = XLSX.readFile(path.resolve(filePath), { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    
    const headers = (rows[0] as unknown[]).map(h => String(h || "").trim().toUpperCase().replace(/\s+/g, " "));
    const plateIdx = headers.indexOf("BIỂN SỐ");
    const nameIdx = headers.indexOf("HỌ TÊN CHỦ XE");
    
    const targets: { plateNumber: string; customerName: string }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => String(c ?? "").trim() !== "")) continue;
      const plate = String(row[plateIdx] || "").trim();
      const name = String(row[nameIdx] || "").trim();
      if (plate) {
        targets.push({ plateNumber: plate, customerName: name });
      }
    }

    const submissionTime = new Date();
    const results: IssuedPolicyResult[] = [];
    for (const target of targets) {
      const res = await this.collectByPlate(target.plateNumber, target.customerName, submissionTime);
      results.push(res);
    }
    return results;
  }

  private async collectByPlate(plateNumber: string, fallbackName: string, submissionTime: Date): Promise<IssuedPolicyResult> {
    const page = this.activePage;
    let certificateNumber: string | undefined;
    let premium: number | undefined;
    let cells: string[] = [];
    let matchedRow: Locator | undefined;

    const targetKey = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Chờ tối đa 60 giây để DIIN sinh số Ấn chỉ (số Seri)
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.issuedCars}`, { waitUntil: "networkidle" });
      const search = page.locator("#search");
      if (await search.count()) {
        await search.fill(plateNumber);
        await search.press("Enter");
        await page.waitForTimeout(1500);
      }
      
      // Đợi lưới dữ liệu tải xong ít nhất 1 dòng
      await page.locator("tr.jqgrow").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

      const rows = page.locator("tr.jqgrow");
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const r = rows.nth(i);
        const rowCells = (await r.locator("td").allInnerTexts()).map(x => x.trim());
        const hasPlate = rowCells.some(cell => {
          const cellKey = cell.toUpperCase().replace(/[^A-Z0-9]/g, "");
          return cellKey === targetKey;
        });
        if (hasPlate) {
          // Lấy cell ngày tạo (Tạo lúc) và parse ngày để so sánh
          const dateCell = rowCells.find(x => /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(x));
          if (dateCell) {
            const diinDate = this.parseDiinDate(dateCell);
            if (diinDate) {
              const diffMsRaw = Math.abs(diinDate.getTime() - submissionTime.getTime());
              const diffMs = diffMsRaw % (12 * 60 * 60 * 1000);
              const closestDiffMs = Math.min(diffMs, 12 * 60 * 60 * 1000 - diffMs);
              if (closestDiffMs <= 90000 && diffMsRaw <= 13 * 60 * 60 * 1000) {
                matchedRow = r;
                cells = rowCells;
                break;
              }
            }
          } else {
            // Fallback nếu không có ngày tạo
            matchedRow = r;
            cells = rowCells;
            break;
          }
        }
      }

      if (matchedRow) {
        // Cột Số Ấn Chỉ (PaperCertificateNo) khớp theo định dạng số Ấn Chỉ mới (5 đến 8 số cuối)
        certificateNumber = cells.find((x) => /D?\d{2}-\d{2}-\d{5,8}-\d+/i.test(x));
        if (certificateNumber) {
          premium = this.parseMoney(cells[15]) || this.parseMoney(cells.find((x) => /^\d{1,3}(\.\d{3})+$/.test(x)));
          break;
        } else {
          matchedRow = undefined;
        }
      }
      console.log(`Chờ sinh số Ấn chỉ cho ${plateNumber}, thử lại lần thứ ${attempt + 1}...`);
      await page.waitForTimeout(5000);
    }

    if (!matchedRow) {
      throw new AppError(502, `Không tìm thấy đơn vừa phát hành: ${plateNumber}`, "DIIN_RESULT_NOT_FOUND");
    }

    const result: IssuedPolicyResult = {
      plateNumber,
      customerName: fallbackName,
      certificateNumber,
      premium
    };
    return { ...result, ...(await this.captureCertificate(matchedRow, certificateNumber ?? plateNumber)) };
  }

  private async captureCertificate(row: Locator, fileStem: string) {
    const gcn = row.getByText(diinSelectors.buttons.certificate).first();
    let pdfUrl: string | undefined;
    if (await gcn.count()) {
      const onclick = await gcn.getAttribute("onclick");
      const match = onclick?.match(/window\.open\(['"](.*?)['"]\)/);
      pdfUrl = match ? match[1] : undefined;
    }

    // Nếu không lấy được onclick hoặc onclick rỗng, tự dựng link PDF chuẩn từ VNG Cloud
    if (!pdfUrl && fileStem && /D?\d{2}-\d{2}-\d{6}-\d+/i.test(fileStem)) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      pdfUrl = `https://hcm03.vstorage.vngcloud.vn/v1/AUTH_7292c955a56f49b890a5d5b28309503c/daily-diin-production/${year}/${month}/${day}/_${fileStem}.pdf`;
    }

    if (!pdfUrl) return {};

    const safeName = fileStem.replace(/[^a-zA-Z0-9._-]/g, "_");
    await fs.mkdir(env.PDF_DIR, { recursive: true });
    const pdfPath = path.resolve(env.PDF_DIR, `${safeName}.pdf`);

    // Tải PDF với cơ chế thử lại nếu VNG Cloud chưa sinh xong file (404)
    let response = await this.activePage.context().request.get(pdfUrl);
    for (let attempt = 0; attempt < 6 && !response.ok(); attempt++) {
      console.log(`Chờ file PDF sẵn sàng trên VNG Cloud, lần thử ${attempt + 1}...`);
      await this.activePage.waitForTimeout(5000);
      response = await this.activePage.context().request.get(pdfUrl);
    }

    if (response.ok()) {
      await fs.writeFile(pdfPath, await response.body());
    }

    return { pdfUrl, pdfPath: response.ok() ? pdfPath : undefined };
  }

  private formatDate(date: Date) {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day = String(vnTime.getUTCDate()).padStart(2, "0");
    const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
    const year = vnTime.getUTCFullYear();
    const hours = String(vnTime.getUTCHours()).padStart(2, "0");
    const minutes = String(vnTime.getUTCMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private parseMoney(value?: string) { return value ? Number(value.replace(/\./g, "").replace(/,/g, ".")) : undefined; }

  private parseDiinDate(dateStr: string): Date | null {
    const cleanStr = dateStr.toUpperCase().replace(/\s+/g, " ");
    const match = cleanStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+(SÁNG|CHIỀU|AM|PM))?/);
    if (!match) return null;
    const [_, day, month, year, hour, minute, second, period] = match;
    let h = parseInt(hour, 10);
    if (period) {
      if ((period === "CHIỀU" || period === "PM") && h < 12) {
        h += 12;
      } else if ((period === "SÁNG" || period === "AM") && h === 12) {
        h = 0;
      }
    }
    const utcMs = Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      h,
      parseInt(minute, 10),
      second ? parseInt(second, 10) : 0
    );
    return new Date(utcMs - 7 * 60 * 60 * 1000);
  }
}
