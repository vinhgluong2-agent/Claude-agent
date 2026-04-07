/**
 * generate-image.js
 * Gọi OpenAI DALL-E 3 API để tạo ảnh từ Master Image Prompt,
 * sau đó tự động tải và lưu file .png vào thư mục /output
 *
 * Setup:
 *   1. Điền OPENAI_API_KEY vào file .env
 *   2. npm install (nếu chưa)
 *   3. node scripts/generate-image.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY = process.env.OPENAI_API_KEY;
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
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // follow redirect
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on("finish", () => file.close(resolve));
        }).on("error", reject);
      } else {
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      }
    }).on("error", reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!API_KEY || API_KEY === "your-openai-api-key") {
    console.error("❌  Thiếu OPENAI_API_KEY trong file .env");
    process.exit(1);
  }

  console.log("🎨  Đang gửi Master Image Prompt đến DALL-E 3...");

  const requestBody = {
    model: "dall-e-3",
    prompt: IMAGE_PROMPT,
    n: 1,
    size: "1024x1792",   // portrait — phù hợp cho nhân vật đứng
    quality: "hd",
    style: "natural",
  };

  const res = await httpsRequest(
    {
      hostname: "api.openai.com",
      path: "/v1/images/generations",
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    },
    requestBody
  );

  if (res.status !== 200) {
    console.error("❌  Lỗi từ API:", JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  const imageUrl = res.body.data?.[0]?.url;
  const revisedPrompt = res.body.data?.[0]?.revised_prompt;

  if (!imageUrl) {
    console.error("❌  Không nhận được URL ảnh.");
    process.exit(1);
  }

  if (revisedPrompt) {
    console.log("\n📝  DALL-E revised prompt:");
    console.log(`   ${revisedPrompt}\n`);
  }

  // Lưu ảnh vào /output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(OUTPUT_DIR, `linh-anh-hero-${timestamp}.png`);

  console.log("⬇️   Đang tải ảnh...");
  await downloadFile(imageUrl, outputPath);

  console.log(`\n✅  Ảnh đã lưu thành công:`);
  console.log(`   ${outputPath}`);
}

main().catch((err) => {
  console.error("❌  Lỗi:", err.message);
  process.exit(1);
});
