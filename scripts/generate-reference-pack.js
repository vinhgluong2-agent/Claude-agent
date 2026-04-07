/**
 * generate-reference-pack.js
 * Tạo đủ 5 góc Reference Pack cho nhân vật Linh Anh
 * Chạy: node scripts/generate-reference-pack.js
 */

const fs   = require("fs");
const path = require("path");
const http = require("http");
const { randomUUID } = require("crypto");

const COMFY_HOST = "127.0.0.1";
const COMFY_PORT = 8000;
const OUTPUT_DIR = path.join(__dirname, "../output/reference-pack");
const CLIENT_ID  = randomUUID();

// ── Base character description (dùng chung) ───────────────────────────────────
const BASE_CHAR =
  "24-year-old Vietnamese woman, natural approachable beauty, " +
  "warm light skin tone with natural healthy glow, realistic pore texture, " +
  "dark black almond-shaped eyes natural single eyelid warm expression, " +
  "long straight black hair falling naturally over shoulders, " +
  "minimal makeup light lip balm groomed eyebrows, " +
  "cream linen top, holding a luxury scented candle jar, " +
  "cozy minimal interior warm soft daylight, " +
  "photorealistic lifestyle photography shot on iPhone 15 Pro 4k natural light authentic Vietnamese beauty";

const NEGATIVE =
  "cartoon, anime, illustration, western features, caucasian, " +
  "heavy makeup, thick eyeshadow, fake lashes, overdone, double eyelid surgery, " +
  "deformed, ugly, blurry, low quality, extra fingers, bad anatomy, " +
  "watermark, text, logo, nsfw, amber eyes, brown eyes, colored eyes, " +
  "低分辨率，低画质，肢体畸形，手指畸形，蜡像感，过度光滑";

// ── 5 Reference Angles ────────────────────────────────────────────────────────
const ANGLES = [
  {
    name: "01-front",
    label: "Front",
    positive: `${BASE_CHAR}, facing camera directly full frontal, neutral soft expression, relaxed hands, upper body frame, flat even front lighting`,
  },
  {
    name: "02-three-quarter-left",
    label: "3/4 Left",
    positive: `${BASE_CHAR}, three-quarter angle facing slightly left, gentle soft smile gazing mid-distance, hair falling over left shoulder, warm rim light from window right side`,
  },
  {
    name: "03-profile",
    label: "Profile",
    positive: `${BASE_CHAR}, pure side profile view, chin slightly lifted calm contemplative expression, hair swept behind ear, jawline and neck visible, strong natural side light from window`,
  },
  {
    name: "04-closeup",
    label: "Close-up",
    positive: `extreme close-up portrait of ${BASE_CHAR}, face fills frame, dark black eyes sharp focus subtle skin pore texture visible, soft bokeh background, golden hour window light, macro detail`,
  },
  {
    name: "05-above-angle",
    label: "Above-angle",
    positive: `${BASE_CHAR}, camera slightly above at 20 degree angle looking down, subject gazes upward with quiet confidence, straight black hair falls down naturally, airy overhead natural daylight`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        try { resolve({ status: res.statusCode, body: JSON.parse(raw.toString()) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function buildWorkflow(positivePrompt) {
  return {
    "60": {
      inputs: { filename_prefix: "linh-anh-ref", images: ["238:231", 0] },
      class_type: "SaveImage",
    },
    "238:219": {
      inputs: { clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors", type: "qwen_image", device: "default" },
      class_type: "CLIPLoader",
    },
    "238:220": {
      inputs: { vae_name: "qwen_image_vae.safetensors" },
      class_type: "VAELoader",
    },
    "238:226": {
      inputs: { unet_name: "qwen_image_edit_2511_bf16.safetensors", weight_dtype: "default" },
      class_type: "UNETLoader",
    },
    "238:221": {
      inputs: { lora_name: "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors", strength_model: 1, model: ["238:226", 0] },
      class_type: "LoraLoaderModelOnly",
    },
    "238:229": { inputs: { value: false }, class_type: "PrimitiveBoolean" },
    "238:233": { inputs: { switch: ["238:229", 0], on_false: ["238:226", 0], on_true: ["238:221", 0] }, class_type: "ComfySwitchNode" },
    "238:222": { inputs: { shift: 3.1, model: ["238:233", 0] }, class_type: "ModelSamplingAuraFlow" },
    "238:227": { inputs: { text: positivePrompt, clip: ["238:219", 0] }, class_type: "CLIPTextEncode" },
    "238:228": { inputs: { text: NEGATIVE, clip: ["238:219", 0] }, class_type: "CLIPTextEncode" },
    "238:232": { inputs: { width: 832, height: 1216, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
    "238:224": { inputs: { value: 50 }, class_type: "PrimitiveInt" },
    "238:225": { inputs: { value: 4  }, class_type: "PrimitiveInt" },
    "238:223": { inputs: { value: 4.0 }, class_type: "PrimitiveFloat" },
    "238:218": { inputs: { value: 1.0 }, class_type: "PrimitiveFloat" },
    "238:240": { inputs: { switch: ["238:229", 0], on_false: ["238:224", 0], on_true: ["238:225", 0] }, class_type: "ComfySwitchNode" },
    "238:243": { inputs: { switch: ["238:229", 0], on_false: ["238:223", 0], on_true: ["238:218", 0] }, class_type: "ComfySwitchNode" },
    "238:230": {
      inputs: {
        seed: Math.floor(Math.random() * 1e15),
        steps: ["238:240", 0], cfg: ["238:243", 0],
        sampler_name: "euler", scheduler: "simple", denoise: 1,
        model: ["238:222", 0], positive: ["238:227", 0], negative: ["238:228", 0], latent_image: ["238:232", 0],
      },
      class_type: "KSampler",
    },
    "238:231": { inputs: { samples: ["238:230", 0], vae: ["238:220", 0] }, class_type: "VAEDecode" },
  };
}

async function generateAngle(angle, index) {
  console.log(`\n[${index + 1}/5] 🎨  ${angle.label}`);

  const submitRes = await httpRequest(
    { hostname: COMFY_HOST, port: COMFY_PORT, path: "/prompt", method: "POST", headers: { "Content-Type": "application/json" } },
    { prompt: buildWorkflow(angle.positive), client_id: CLIENT_ID }
  );

  if (submitRes.status !== 200 || !submitRes.body?.prompt_id) {
    console.error(`   ❌ Lỗi submit: ${JSON.stringify(submitRes.body)}`);
    return;
  }

  const promptId = submitRes.body.prompt_id;
  console.log(`   ⏳ Job: ${promptId}`);

  for (let i = 1; i <= 200; i++) {
    await sleep(3000);
    const histRes = await httpRequest({ hostname: COMFY_HOST, port: COMFY_PORT, path: `/history/${promptId}`, method: "GET" });
    const entry  = histRes.body?.[promptId];
    const status = entry?.status?.status_str;

    if (!entry) { process.stdout.write(`   #${i} xếp hàng...\r`); continue; }
    if (i % 5 === 0) process.stdout.write(`   #${i} ${status}...\r`);

    if (status === "success") {
      const imgInfo = entry.outputs?.["60"]?.images?.[0];
      if (!imgInfo) { console.error("   ❌ Không tìm thấy ảnh."); return; }

      const imgRes = await httpRequest({
        hostname: COMFY_HOST, port: COMFY_PORT,
        path: `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${imgInfo.subfolder}&type=${imgInfo.type}`,
        method: "GET",
      });

      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      const ext = imgInfo.filename.split(".").pop() || "png";
      const outputPath = path.join(OUTPUT_DIR, `${angle.name}.${ext}`);
      fs.writeFileSync(outputPath, imgRes.body);
      console.log(`   ✅ Lưu: output/reference-pack/${angle.name}.${ext}`);
      return;
    }

    if (status === "error") { console.error(`   ❌ Lỗi: ${JSON.stringify(entry?.status)}`); return; }
  }
  console.error("   ❌ Timeout.");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔌  Kiểm tra ComfyUI...");
  try {
    await httpRequest({ hostname: COMFY_HOST, port: COMFY_PORT, path: "/system_stats", method: "GET" });
  } catch {
    console.error("❌  Không kết nối được. Hãy mở ComfyUI trước."); process.exit(1);
  }
  console.log("✅  ComfyUI đang chạy.");
  console.log("📸  Bắt đầu tạo 5 góc Reference Pack — Linh Anh × Nến cao cấp\n");

  for (let i = 0; i < ANGLES.length; i++) {
    await generateAngle(ANGLES[i], i);
  }

  console.log("\n🎉  Hoàn thành! Tất cả ảnh đã lưu vào: output/reference-pack/");
  console.log("   01-front.png");
  console.log("   02-three-quarter-left.png");
  console.log("   03-profile.png");
  console.log("   04-closeup.png");
  console.log("   05-above-angle.png");
}

main().catch((err) => { console.error("❌  Lỗi:", err.message); process.exit(1); });
