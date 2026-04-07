/**
 * generate-video.js
 * Gọi Google Vertex AI Veo 3 API để tạo video từ prompt,
 * sau đó tự động lưu file .mp4 vào thư mục /output
 *
 * Setup:
 *   1. Điền GOOGLE_PROJECT_ID vào file .env
 *   2. Đặt file service-account.json vào thư mục gốc
 *   3. npm install && node scripts/generate-video.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const https = require("https");
const { GoogleAuth } = require("google-auth-library");

// ── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.GOOGLE_LOCATION || "us-central1";
const OUTPUT_DIR = path.join(__dirname, "../output");
const MODEL = "veo-3.0-generate-preview";

// ── Video Prompt (Cảnh 1 — Thắp nến) ────────────────────────────────────────
const VIDEO_PROMPT = `
Linh Anh stands at a marble side table in a minimal living room, golden afternoon light filters
through linen curtains. She slowly lifts a luxury candle jar with both hands, brings it close
to her face, eyes close gently as she inhales — subtle smile forms.
Micro-movements: gentle finger adjustment on glass, slight head tilt forward while smelling,
eyelashes flutter, soft exhale visible. Static shot, shallow depth of field.
Shot on iPhone 15 Pro, 4k cinematic, natural daylight.
Character: 24-year-old Vietnamese woman, warm ivory skin, amber-brown eyes, black shoulder-length hair,
cream silk blouse, one thin gold ring. Elegant and understated luxury aesthetic.
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!PROJECT_ID || PROJECT_ID === "your-project-id") {
    console.error("❌  Thiếu GOOGLE_PROJECT_ID trong file .env");
    process.exit(1);
  }

  // Lấy access token
  console.log("🔑  Đang xác thực với Google Cloud...");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;

  // Gọi Veo 3 API — tạo Long Running Operation
  console.log("🎬  Đang gửi prompt đến Veo 3...");
  const apiHost = "us-central1-aiplatform.googleapis.com";
  const apiPath = `/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`;

  const requestBody = {
    instances: [{ prompt: VIDEO_PROMPT }],
    parameters: {
      durationSeconds: 8,
      aspectRatio: "9:16",
      sampleCount: 1,
    },
  };

  const submitRes = await httpsRequest(
    {
      hostname: apiHost,
      path: apiPath,
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
    requestBody
  );

  if (submitRes.status !== 200) {
    console.error("❌  Lỗi khi gọi API:", JSON.stringify(submitRes.body, null, 2));
    process.exit(1);
  }

  const operationName = submitRes.body.name;
  console.log(`⏳  Operation bắt đầu: ${operationName}`);
  console.log("   Veo 3 thường mất 2-5 phút để tạo video...");

  // Polling cho đến khi done
  let done = false;
  let result = null;
  let attempt = 0;

  while (!done) {
    attempt++;
    await sleep(15000); // poll mỗi 15 giây

    const pollPath = `/v1/${operationName}`;
    const pollRes = await httpsRequest({
      hostname: apiHost,
      path: pollPath,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const op = pollRes.body;
    process.stdout.write(`   Lần kiểm tra #${attempt}: ${op.done ? "✅ Xong!" : "⌛ Đang xử lý..."}\n`);

    if (op.done) {
      done = true;
      result = op;
    }

    if (attempt > 40) {
      console.error("❌  Timeout sau 10 phút. Vui lòng kiểm tra lại.");
      process.exit(1);
    }
  }

  // Xử lý kết quả
  if (result.error) {
    console.error("❌  API trả về lỗi:", JSON.stringify(result.error, null, 2));
    process.exit(1);
  }

  const predictions = result.response?.predictions;
  if (!predictions || predictions.length === 0) {
    console.error("❌  Không có video nào được trả về.");
    console.log("Response:", JSON.stringify(result.response, null, 2));
    process.exit(1);
  }

  // Lưu video vào /output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(OUTPUT_DIR, `linh-anh-candle-scene1-${timestamp}.mp4`);

  const videoData = predictions[0].bytesBase64Encoded || predictions[0].video?.bytesBase64Encoded;

  if (!videoData) {
    console.log("⚠️  Không tìm thấy video bytes. Raw response:");
    console.log(JSON.stringify(predictions[0], null, 2));
    process.exit(1);
  }

  fs.writeFileSync(outputPath, Buffer.from(videoData, "base64"));
  console.log(`\n✅  Video đã lưu thành công:`);
  console.log(`   ${outputPath}`);
}

main().catch((err) => {
  console.error("❌  Lỗi không mong đợi:", err.message);
  process.exit(1);
});
