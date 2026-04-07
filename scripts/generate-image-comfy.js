/**
 * generate-image-comfy.js
 * Gọi ComfyUI API (localhost:8188) dùng workflow Qwen-Image 2512
 * để tạo ảnh từ Master Image Prompt, lưu vào /output
 *
 * Chạy: node scripts/generate-image-comfy.js
 */

const fs   = require("fs");
const path = require("path");
const http = require("http");
const { randomUUID } = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────
const COMFY_HOST = "127.0.0.1";
const COMFY_PORT = 8000;
const OUTPUT_DIR = path.join(__dirname, "../output");
const CLIENT_ID  = randomUUID();

// ── Master Image Prompt (Linh Anh — Luxury Candle) ───────────────────────────
const POSITIVE_PROMPT =
  "A 24-year-old Vietnamese woman, natural and approachable beauty, " +
  "warm light skin tone with natural healthy glow, realistic pore texture, " +
  "dark black almond-shaped eyes with natural single eyelid, genuine warm expression, soft natural smile, " +
  "long straight black hair falling naturally over shoulders, " +
  "minimal makeup — just light tinted lip balm and groomed eyebrows, " +
  "wearing a simple cream linen top, relaxed and comfortable style, " +
  "holding a luxury scented candle jar with both hands, " +
  "standing near a bright window in a cozy minimal interior, warm soft daylight, " +
  "shallow depth of field, photorealistic, lifestyle photography, " +
  "shot on iPhone 15 Pro, 4k, natural light, authentic Vietnamese beauty";

const NEGATIVE_PROMPT =
  "cartoon, anime, illustration, western features, european, caucasian, " +
  "heavy makeup, thick eyeshadow, fake lashes, glamour, overdone, " +
  "double eyelid surgery look, k-beauty overdone, " +
  "deformed, ugly, blurry, low quality, extra fingers, bad anatomy, " +
  "watermark, text, logo, nsfw, amber eyes, brown eyes, colored eyes, " +
  "低分辨率，低画质，肢体畸形，手指畸形，蜡像感，过度光滑";

// ── Build workflow (giữ nguyên node IDs từ workflow gốc) ─────────────────────
function buildWorkflow() {
  return {
    "60": {
      inputs: { filename_prefix: "linh-anh-hero", images: ["238:231", 0] },
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
      inputs: {
        lora_name: "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors",
        strength_model: 1,
        model: ["238:226", 0],
      },
      class_type: "LoraLoaderModelOnly",
    },
    "238:229": {
      inputs: { value: false },   // false = dùng 50 steps (chất lượng cao)
      class_type: "PrimitiveBoolean",
    },
    "238:233": {
      inputs: { switch: ["238:229", 0], on_false: ["238:226", 0], on_true: ["238:221", 0] },
      class_type: "ComfySwitchNode",
    },
    "238:222": {
      inputs: { shift: 3.1, model: ["238:233", 0] },
      class_type: "ModelSamplingAuraFlow",
    },
    "238:227": {
      inputs: { text: POSITIVE_PROMPT, clip: ["238:219", 0] },
      class_type: "CLIPTextEncode",
    },
    "238:228": {
      inputs: { text: NEGATIVE_PROMPT, clip: ["238:219", 0] },
      class_type: "CLIPTextEncode",
    },
    "238:232": {
      inputs: { width: 832, height: 1216, batch_size: 1 },  // portrait
      class_type: "EmptySD3LatentImage",
    },
    "238:224": { inputs: { value: 50 }, class_type: "PrimitiveInt" },   // steps (normal)
    "238:225": { inputs: { value: 4  }, class_type: "PrimitiveInt" },   // steps (LoRA)
    "238:223": { inputs: { value: 4  }, class_type: "PrimitiveFloat" }, // cfg (normal)
    "238:218": { inputs: { value: 1  }, class_type: "PrimitiveFloat" }, // cfg (LoRA)
    "238:240": {
      inputs: { switch: ["238:229", 0], on_false: ["238:224", 0], on_true: ["238:225", 0] },
      class_type: "ComfySwitchNode",
    },
    "238:243": {
      inputs: { switch: ["238:229", 0], on_false: ["238:223", 0], on_true: ["238:218", 0] },
      class_type: "ComfySwitchNode",
    },
    "238:230": {
      inputs: {
        seed: Math.floor(Math.random() * 1e15),
        steps: ["238:240", 0],
        cfg:   ["238:243", 0],
        sampler_name: "euler",
        scheduler:    "simple",
        denoise: 1,
        model:        ["238:222", 0],
        positive:     ["238:227", 0],
        negative:     ["238:228", 0],
        latent_image: ["238:232", 0],
      },
      class_type: "KSampler",
    },
    "238:231": {
      inputs: { samples: ["238:230", 0], vae: ["238:220", 0] },
      class_type: "VAEDecode",
    },
  };
}

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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔌  Kết nối ComfyUI tại ${COMFY_HOST}:${COMFY_PORT}...`);

  try {
    await httpRequest({ hostname: COMFY_HOST, port: COMFY_PORT, path: "/system_stats", method: "GET" });
  } catch {
    console.error("❌  Không kết nối được. Hãy mở ComfyUI trước.");
    process.exit(1);
  }
  console.log("✅  ComfyUI đang chạy.\n");
  console.log("🎨  Model: Qwen-Image 2512 | Size: 832×1216 (portrait) | Steps: 50");
  console.log("⏳  Đang tạo ảnh...\n");

  // Submit
  const submitRes = await httpRequest(
    {
      hostname: COMFY_HOST, port: COMFY_PORT, path: "/prompt", method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { prompt: buildWorkflow(), client_id: CLIENT_ID }
  );

  if (submitRes.status !== 200 || !submitRes.body?.prompt_id) {
    console.error("❌  Lỗi submit:", JSON.stringify(submitRes.body, null, 2));
    process.exit(1);
  }

  const promptId = submitRes.body.prompt_id;
  console.log(`   Job ID: ${promptId}`);

  // Poll
  for (let i = 1; i <= 200; i++) {
    await sleep(2000);
    const histRes = await httpRequest({
      hostname: COMFY_HOST, port: COMFY_PORT,
      path: `/history/${promptId}`, method: "GET",
    });

    const entry  = histRes.body?.[promptId];
    const status = entry?.status?.status_str;

    if (!entry) { process.stdout.write(`   #${i}: xếp hàng...\n`); continue; }
    process.stdout.write(`   #${i}: ${status}\n`);

    if (status === "success") {
      const imgInfo = entry.outputs?.["60"]?.images?.[0];
      if (!imgInfo) { console.error("❌  Không tìm thấy ảnh trong output."); process.exit(1); }

      // Lấy file ảnh
      const imgRes = await httpRequest({
        hostname: COMFY_HOST, port: COMFY_PORT,
        path: `/view?filename=${encodeURIComponent(imgInfo.filename)}&subfolder=${imgInfo.subfolder}&type=${imgInfo.type}`,
        method: "GET",
      });

      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const ext = imgInfo.filename.split(".").pop() || "png";
      const outputPath = path.join(OUTPUT_DIR, `linh-anh-hero-${timestamp}.${ext}`);

      fs.writeFileSync(outputPath, imgRes.body);
      console.log(`\n✅  Ảnh đã lưu:`);
      console.log(`   ${outputPath}`);
      return;
    }

    if (status === "error") {
      console.error("❌  Lỗi:", JSON.stringify(entry?.status, null, 2));
      process.exit(1);
    }
  }

  console.error("❌  Timeout.");
  process.exit(1);
}

main().catch((err) => { console.error("❌  Lỗi:", err.message); process.exit(1); });
