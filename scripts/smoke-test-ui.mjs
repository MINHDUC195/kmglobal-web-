import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:3000";

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

const ROUTES = [
  { path: "/", label: "home", protected: false },
  { path: "/courses", label: "courses", protected: false },
  { path: "/verify", label: "verify", protected: false },
  { path: "/login", label: "login", protected: false },
  { path: "/checkout", label: "checkout", protected: false },
  { path: "/owner/reports", label: "owner_reports", protected: true },
];

const findings = {
  critical: [],
  high: [],
  medium: [],
  low: [],
};

function pushFinding(severity, data) {
  findings[severity].push(data);
}

function snip(text, len = 140) {
  if (!text) return "";
  return text.length > len ? `${text.slice(0, len)}...` : text;
}

async function analyzePage(page, route, viewportName, httpStatus) {
  const url = page.url();

  if (!httpStatus || httpStatus >= 500) {
    pushFinding("critical", {
      route: route.path,
      viewport: viewportName,
      issue: `HTTP ${httpStatus ?? "NO_RESPONSE"}`,
      repro: `Open ${route.path} on ${viewportName}`,
    });
  }

  if (route.protected) {
    if (!url.includes("/login")) {
      pushFinding("high", {
        route: route.path,
        viewport: viewportName,
        issue: `Protected route did not redirect to login (${url})`,
        repro: `Open ${route.path} as guest`,
      });
    }
  }

  const pageErrors = await page.evaluate(() => {
    const overflows = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width - window.innerWidth > 2) {
        overflows.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className || "",
          width: Math.round(r.width),
          viewport: window.innerWidth,
        });
      }
      if (overflows.length >= 4) break;
    }

    const clickableNoLabel = [];
    for (const btn of document.querySelectorAll("button")) {
      const text = (btn.textContent || "").trim();
      const aria = btn.getAttribute("aria-label");
      if (!text && !aria) {
        clickableNoLabel.push(btn.className || "button");
      }
      if (clickableNoLabel.length >= 4) break;
    }

    return {
      title: document.title,
      overflows,
      clickableNoLabel,
      hasMain: Boolean(document.querySelector("main")),
      bodyTextLen: (document.body?.innerText || "").trim().length,
    };
  });

  if (!pageErrors.hasMain) {
    pushFinding("medium", {
      route: route.path,
      viewport: viewportName,
      issue: "Missing <main> landmark on page",
      repro: `Open ${route.path}`,
    });
  }

  if (pageErrors.overflows.length > 0) {
    pushFinding("high", {
      route: route.path,
      viewport: viewportName,
      issue: `Horizontal overflow elements: ${pageErrors.overflows
        .map((x) => `${x.tag}.${snip(String(x.cls), 28)}(${x.width}>${x.viewport})`)
        .join(", ")}`,
      repro: `Open ${route.path} in ${viewportName}; inspect width overflow`,
    });
  }

  if (pageErrors.clickableNoLabel.length > 0) {
    pushFinding("medium", {
      route: route.path,
      viewport: viewportName,
      issue: `Buttons without text/aria-label: ${pageErrors.clickableNoLabel.join(", ")}`,
      repro: `Open ${route.path} and inspect buttons`,
    });
  }

  if (pageErrors.bodyTextLen < 40) {
    pushFinding("medium", {
      route: route.path,
      viewport: viewportName,
      issue: "Very low visible text content, possible blank/partial render",
      repro: `Open ${route.path} and verify rendered content`,
    });
  }
}

async function testVerifyFlow(page, viewportName) {
  await page.goto(`${BASE_URL}/verify`, { waitUntil: "networkidle2", timeout: 20000 });

  const input = await page.$("#certificate-code");
  const submit = await page.$("button[type='submit']");
  if (!input || !submit) {
    pushFinding("high", {
      route: "/verify",
      viewport: viewportName,
      issue: "Missing verify input or submit button",
      repro: "Open /verify and inspect form",
    });
    return;
  }

  await submit.click();
  await new Promise((r) => setTimeout(r, 500));
  const emptyError = await page.evaluate(() => document.body.innerText.includes("Vui lòng nhập mã chứng chỉ"));
  if (!emptyError) {
    pushFinding("high", {
      route: "/verify",
      viewport: viewportName,
      issue: "Empty form submission does not show validation message",
      repro: "Open /verify and click Tra cứu with empty input",
    });
  }

  await input.click({ clickCount: 3 });
  await input.type("KM-INVALID");
  await submit.click();
  await new Promise((r) => setTimeout(r, 900));
  const invalidError = await page.evaluate(() => document.body.innerText.includes("Không tìm thấy chứng chỉ"));
  if (!invalidError) {
    pushFinding("medium", {
      route: "/verify",
      viewport: viewportName,
      issue: "Invalid code feedback not clear (expected not-found message)",
      repro: "Input KM-INVALID and submit on /verify",
    });
  }
}

function buildReport() {
  const order = ["critical", "high", "medium", "low"];
  const total = order.reduce((n, k) => n + findings[k].length, 0);
  const lines = [];
  lines.push(`# Smoke Test Report (${new Date().toISOString()})`);
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Total findings: ${total}`);
  for (const k of order) lines.push(`- ${k}: ${findings[k].length}`);
  lines.push("");

  for (const k of order) {
    lines.push(`## ${k.toUpperCase()}`);
    if (findings[k].length === 0) {
      lines.push("- None");
      lines.push("");
      continue;
    }
    findings[k].forEach((f, idx) => {
      lines.push(`${idx + 1}. [${f.route}] (${f.viewport}) ${f.issue}`);
      lines.push(`   - Repro: ${f.repro}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  await mkdir("test-artifacts", { recursive: true });
  await mkdir("test-artifacts/screenshots", { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile,
        deviceScaleFactor: 1,
      });

      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      for (const route of ROUTES) {
        let status = null;
        try {
          const res = await page.goto(`${BASE_URL}${route.path}`, {
            waitUntil: "networkidle2",
            timeout: 20000,
          });
          status = res?.status() ?? null;
          await page.screenshot({
            path: `test-artifacts/screenshots/${route.label}-${vp.name}.png`,
            fullPage: true,
          });
          await analyzePage(page, route, vp.name, status);
        } catch (e) {
          pushFinding("critical", {
            route: route.path,
            viewport: vp.name,
            issue: `Navigation exception: ${snip(String(e), 180)}`,
            repro: `Open ${route.path} in ${vp.name}`,
          });
        }
      }

      await testVerifyFlow(page, vp.name);

      for (const c of consoleErrors) {
        pushFinding("medium", {
          route: "*",
          viewport: vp.name,
          issue: `Console error: ${snip(c, 180)}`,
          repro: `Open core routes on ${vp.name}, check browser console`,
        });
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  const report = buildReport();
  await writeFile("test-artifacts/smoke-test-report.md", report, "utf8");
  console.log(report);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
