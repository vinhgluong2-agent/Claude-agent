/**
 * generate-image-flux.js
 * Gọi Flux Pro API qua fal.ai để tạo ảnh từ Master Image Prompt,
 * sau đó tự động tải và lưu file .jpg vào thư mục /output
 *
 * Setup:
 *   1. Đăng ký tại fal.ai, lấy API key
 *   2. Điền FAL_KEY vào file .env
 *   3. node scripts/generate-image-flux.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Config ────────────────────────────────────────────────────────────────────
const FAL_KEY = process.env.FAL_KEY;
const OUTPUT_DIR = path.join(__dirname, "../output");

// ── Master Image Prompt (Linh Anh — Luxury Candle) ───────────────────────────
const IMAGE_PROMPT = `A 24-year-old Vietnamese woman named Linh Anh, elegant and understated.
Warm ivory skin with subtle natural pore texture visible under soft light.
Amber-brown deep eyes, slightly elongated, calm and intelligent gaze.
Natural black hair, shoulder-length, loosely pinned on one side.
Nude-pink full lips, no heavy makeup — just a soft glow.
Wearing a cream silk blouse and high-waist beige trousers, one thin gold ring.
Standing in a minimal modern interior — warm linen tones, muted background.
Shot on iPhone 15 Pro, 4k cinematic, natural window daylight, shallow depth of field.
Photorealistic, editorial style, luxury lifestyle brand aesthetic.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // follow redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location);
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!FAL_KEY || FAL_KEY === "your-fal-api-key") {
    console.error("❌  Thiếu FAL_KEY trong file .env");
    console.error("   Lấy key tại: https://fal.ai/dashboard/keys");
    process.exit(1);
  }

  console.log("🎨  Đang gửi Master Image Prompt đến Flux Pro...");

  const headers = {
    Authorization: `Key ${FAL_KEY}`,
    "Content-Type": "application/json",
  };

  // Submit job (async queue)
  const submitRes = await httpsPost(
    "queue.fal.run",
    "/fal-ai/flux-pro/v1.1",
    headers,
    {
      prompt: IMAGE_PROMPT,
      image_size: "portrait_4_3",   // 768x1024 portrait
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      enable_safety_checker: true,
    }
  );

  if (submitRes.status !== 200) {
    console.error("❌  Lỗi submit:", JSON.stringify(submitRes.body, null, 2));
    process.exit(1);
  }

  const requestId = submitRes.body.request_id;
  console.log(`⏳  Job ID: ${requestId}`);
  console.log("   Đang xử lý...");

  // Poll status
  let resultUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const statusRes = await httpsGet(
      `https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}/status`
    );
    const st = statusRes.body?.status;
    process.stdout.write(`   #${i + 1}: ${st}\n`);
    if (st === "COMPLETED") {
      resultUrl = `https://queue.fal.run/fal-ai/flux-pro/v1.1/requests/${requestId}`;
      break;
    }
    if (st === "FAILED") {
      console.error("❌  Job thất bại:", JSON.stringify(statusRes.body, null, 2));
      process.exit(1);
    }
  }

  if (!resultUrl) {
    console.error("❌  Timeout sau 90 giây.");
    process.exit(1);
  }

  // Lấy kết quả
  const resultRes = await httpsGet(resultUrl);
  const imageUrl = resultRes.body?.images?.[0]?.url;

  if (!imageUrl) {
    console.error("❌  Không lấy được URL ảnh.");
    console.log(JSON.stringify(resultRes.body, null, 2));
    process.exit(1);
  }

  // Lưu vào /output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(OUTPUT_DIR, `linh-anh-hero-flux-${timestamp}.jpg`);

  console.log("⬇️   Đang tải ảnh...");
  await downloadFile(imageUrl, outputPath);

  console.log(`\n✅  Ảnh đã lưu thành công:`);
  console.log(`   ${outputPath}`);
}

main().catch((err) => {
  console.error("❌  Lỗi:", err.message);
  process.exit(1);
});
