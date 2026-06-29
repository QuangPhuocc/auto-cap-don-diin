import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
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
    const context = await this.browser.newContext({ acceptDownloads: true, locale: "vi-VN" });
    this.page = await context.newPage();
    this.page.setDefaultTimeout(env.DIIN_TIMEOUT_MS);
    await this.login();
  }

  async stop() {
    await this.browser?.close();
    this.browser = undefined;
    this.page = undefined;
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
    await page.waitForLoadState("networkidle");
    if (!page.url().startsWith(env.DIIN_BASE_URL) || page.url().includes("/Authentication/SignIn")) {
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
    if (policy.effectiveDate) await page.locator("#EffectiveDate").fill(this.formatDate(policy.effectiveDate));
    await page.locator("#NumberYearInsure").fill(String(policy.insuranceYears ?? 1));
    await page.locator("#btn-premium").click();
    await page.waitForLoadState("networkidle");
    await page.locator("#btn-submit").click();
    await page.waitForLoadState("networkidle");
    const issueButton = page.getByRole("button", { name: diinSelectors.buttons.issue });
    if (await issueButton.count()) { await issueButton.click(); await page.waitForLoadState("networkidle"); }
    return this.collectByPlate(policy.plateNumber, policy.customerName);
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
    await this.clickButton(diinSelectors.buttons.calculate);
    await page.waitForLoadState("networkidle");
    await this.clickButton(diinSelectors.buttons.issue);
    await page.waitForLoadState("networkidle");
    return this.collectBatchRows();
  }

  private async collectByPlate(plateNumber: string, fallbackName: string): Promise<IssuedPolicyResult> {
    const page = this.activePage;
    let certificateNumber: string | undefined;
    let premium: number | undefined;
    let cells: string[] = [];
    let matchedRow: Locator | undefined;

    const targetKey = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Chờ tối đa 30 giây để DIIN sinh số Ấn chỉ (số Seri)
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.goto(`${env.DIIN_BASE_URL}${diinSelectors.links.issuedCars}`, { waitUntil: "networkidle" });
      const search = page.locator("#search");
      if (await search.count()) {
        await search.fill(plateNumber);
        await search.press("Enter");
        await page.waitForTimeout(1500);
      }
      
      const rows = page.locator("tr.jqgrow");
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const r = rows.nth(i);
        const rowCells = (await r.locator("td").allInnerTexts()).map(x => x.trim());
        const plateCell = rowCells[6] || rowCells.find(x => /\d{2}[A-Z]-?[\d.]+/i.test(x)) || "";
        const cellKey = plateCell.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cellKey === targetKey) {
          matchedRow = r;
          cells = rowCells;
          break;
        }
      }

      if (matchedRow) {
        // Cột Số Ấn Chỉ (PaperCertificateNo) nằm ở index 18
        certificateNumber = cells[18] || cells.find((x) => /D?\d{2}-\d{2}-\d{6}-\d+/i.test(x));
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
      customerName: cells[9] || cells.find((x) => x.trim() === fallbackName)?.trim() || fallbackName,
      certificateNumber,
      premium
    };
    return { ...result, ...(await this.captureCertificate(matchedRow, certificateNumber ?? plateNumber)) };
  }

  private async collectBatchRows(): Promise<IssuedPolicyResult[]> {
    const page = this.activePage;
    let results: IssuedPolicyResult[] = [];
    
    // Chờ tối đa 30 giây để tất cả các dòng đều có số Seri (Seri Ac)
    for (let attempt = 0; attempt < 6; attempt++) {
      const rows = page.locator("tr.jqgrow");
      const count = await rows.count();
      results = [];
      let allHaveSeri = true;

      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const cells = (await row.locator("td").allInnerTexts()).map((x) => x.trim());
        if (!cells.length) continue;
        
        // Trong /InsuranceMasterDetail, cột Seri Ac có index 15, Biển số index 6, Họ & Tên index 9
        const certificateNumber = cells[15] || cells.find((x) => /D?\d{2}-\d{2}-\d{6}-\d+/i.test(x));
        const plateNumber = (cells[6] || cells.find((x) => /\d{2}[A-Z]-?[\d.]+/i.test(x))) ?? "UNKNOWN";
        const customerName = cells[9] || cells.find((x) => /[A-ZÀ-Ỹ]{2,}\s+[A-ZÀ-Ỹ]/i.test(x)) || "";
        
        if (!certificateNumber) {
          allHaveSeri = false;
        }

        results.push({
          plateNumber,
          customerName,
          certificateNumber
        });
      }

      if (allHaveSeri && results.length > 0) {
        break;
      }
      
      console.log(`Chờ sinh số Seri cho bảng kê, thử lại lần thứ ${attempt + 1}...`);
      await page.waitForTimeout(5000);
      await page.reload({ waitUntil: "networkidle" });
    }

    // Sau khi đã có (hoặc hết thời gian chờ), tải PDF cho từng dòng
    const finalResults: IssuedPolicyResult[] = [];
    const rows = page.locator("tr.jqgrow");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const base = results[i];
      if (!base) continue;
      const certInfo = await this.captureCertificate(row, base.certificateNumber ?? `${Date.now()}-${i}`);
      finalResults.push({ ...base, ...certInfo });
    }

    if (!finalResults.length) throw new AppError(502, "DIIN không trả về dòng kết quả sau phát hành", "DIIN_EMPTY_RESULT");
    return finalResults;
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
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private parseMoney(value?: string) { return value ? Number(value.replace(/\./g, "").replace(/,/g, ".")) : undefined; }
}
