import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { env } from "../config/env.js";
import { diinSelectors } from "./diin.selectors.js";

/**
 * DiinBrowserPool — Singleton quản lý 1 browser duy nhất với nhiều tab song song.
 *
 * Thiết kế:
 * - 1 Browser (Chromium process) chia sẻ session DIIN (cookie chung)
 * - Mỗi job gọi acquirePage() → nhận 1 tab mới riêng biệt
 * - Sau khi job xong, gọi page.close() để trả tab về
 * - Login 1 lần, tất cả tab đều được xác thực
 * - Nếu session hết hạn, 1 tab sẽ re-login, các tab khác đợi
 */
class DiinBrowserPool {
  private browser?: Browser;
  private context?: BrowserContext;

  /** Mutex đơn giản: promise đang login thì các caller khác await vào đây */
  private initPromise?: Promise<void>;
  private reloginPromise?: Promise<void>;

  /**
   * Lấy 1 page (tab) mới từ browser pool.
   * Nếu browser chưa khởi tạo → tự khởi tạo + login.
   * Caller phải gọi page.close() sau khi dùng xong.
   */
  async acquirePage(): Promise<Page> {
    await this.ensureInitialized();
    const page = await this.context!.newPage();
    page.setDefaultTimeout(env.DIIN_TIMEOUT_MS);
    return page;
  }

  /**
   * Gọi sau khi phát hiện session DIIN hết hạn (redirect về login).
   * Chỉ 1 tab thực hiện relogin, các tab khác đợi.
   */
  async relogin(): Promise<void> {
    // Nếu đang relogin, đợi promise hiện tại
    if (this.reloginPromise) {
      return this.reloginPromise;
    }
    this.reloginPromise = this._doRelogin();
    try {
      await this.reloginPromise;
    } finally {
      this.reloginPromise = undefined;
    }
  }

  private async _doRelogin(): Promise<void> {
    if (!this.context) return;
    console.log("[Pool] Session DIIN hết hạn — đang re-login...");
    const page = await this.context.newPage();
    try {
      await this._login(page);
      console.log("[Pool] Re-login thành công");
    } finally {
      await page.close();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.context && this.browser?.isConnected()) return;
    if (this.initPromise) {
      // Đang init → đợi
      return this.initPromise;
    }
    this.initPromise = this._init();
    try {
      await this.initPromise;
    } catch (err) {
      // Reset để lần sau có thể thử lại
      this.initPromise = undefined;
      this.browser = undefined;
      this.context = undefined;
      throw err;
    }
  }

  private async _init(): Promise<void> {
    console.log("[Pool] Khởi tạo Chromium browser...");
    this.browser = await chromium.launch({ headless: env.DIIN_HEADLESS });
    this.context = await this.browser.newContext({
      acceptDownloads: true,
      locale: "vi-VN",
      // Video chỉ bật khi cần debug (tiết kiệm ổ cứng)
      ...(env.DIIN_RECORD_VIDEO
        ? { recordVideo: { dir: "./videos-production", size: { width: 1280, height: 720 } } }
        : {})
    });
    // Login 1 lần, cookie được chia sẻ với tất cả tabs
    const loginPage = await this.context.newPage();
    loginPage.setDefaultTimeout(env.DIIN_TIMEOUT_MS);
    try {
      await this._login(loginPage);
      console.log("[Pool] Đăng nhập DIIN thành công");
    } finally {
      await loginPage.close();
    }
  }

  private async _login(page: Page): Promise<void> {
    if (!env.DIIN_USERNAME || !env.DIIN_PASSWORD) {
      throw new Error("Chưa cấu hình DIIN_USERNAME / DIIN_PASSWORD");
    }
    await page.goto(env.DIIN_BASE_URL, { waitUntil: "domcontentloaded" });

    // Nếu đã đăng nhập rồi thì bỏ qua
    if (await page.getByText(/Bảng kê Bảo hiểm/i).first().isVisible().catch(() => false)) {
      return;
    }

    // Điền username
    const usernameLocator = await this._firstExisting(page, diinSelectors.login.username);
    await usernameLocator.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, env.DIIN_USERNAME);

    // Điền password
    const passwordLocator = await this._firstExisting(page, diinSelectors.login.password);
    await passwordLocator.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, env.DIIN_PASSWORD);

    // Submit form
    await page.locator("form").first().evaluate((form) => (form as HTMLFormElement).submit());

    // Đợi đăng nhập thành công
    const loggedIn = await page
      .locator("a", { hasText: "Bảng kê Bảo hiểm" })
      .first()
      .waitFor({ state: "visible", timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    if (!loggedIn) {
      throw new Error("Đăng nhập DIIN thất bại — kiểm tra USERNAME/PASSWORD");
    }
  }

  private async _firstExisting(page: Page, selectors: readonly string[]) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count().catch(() => 0)) return locator;
    }
    throw new Error(`Không tìm thấy selector: ${selectors.join(" | ")}`);
  }

  /** Dọn dẹp khi shutdown server */
  async destroy(): Promise<void> {
    console.log("[Pool] Đóng Chromium browser...");
    await this.browser?.close();
    this.browser = undefined;
    this.context = undefined;
    this.initPromise = undefined;
  }
}

/** Singleton toàn app — dùng chung 1 browser với N tabs */
export const diinPool = new DiinBrowserPool();

/** Mutex đơn giản để đồng bộ hóa (serialize) quá trình lưu đơn và đọc GCN */
class SimpleMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next?.();
        } else {
          this.locked = false;
        }
      };

      if (this.locked) {
        this.queue.push(() => resolve(release));
      } else {
        this.locked = true;
        resolve(release);
      }
    });
  }
}

export const submitMutex = new SimpleMutex();

