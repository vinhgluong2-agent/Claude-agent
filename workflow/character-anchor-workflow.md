# Character Anchor Workflow
> Quy trình chuẩn hóa tạo nhân vật & tích hợp sản phẩm cho ảnh và video AI

---

## Giai đoạn 1: Thiết lập Character Anchor (Neo nhân vật)

**Mục tiêu:** Tạo nhân vật nhất quán qua mọi cảnh quay.

1. **Persona** — Mô tả chi tiết nhân vật:
   - Tên, tuổi, phong cách sống
   - Đặc điểm da (pore-level), màu mắt, kiểu tóc
   - Trang phục, phụ kiện đặc trưng

2. **Master Image Prompt** — Dùng cho Arcads / Midjourney:
   - Tập trung: đặc điểm da, màu mắt, kiểu tóc, ánh sáng
   - Đây là ảnh gốc (Hero Image) — mọi prompt sau phải giữ nhất quán với ảnh này

3. **Reference Pack** — 5 góc chụp tham chiếu:
   - Front (thẳng mặt)
   - 3/4 Left (nghiêng trái)
   - Profile (nhìn nghiêng)
   - Close-up (cận mặt)
   - Above-angle (góc cao nhìn xuống)

---

## Giai đoạn 2: Tích hợp Bối cảnh & Sản phẩm

**Mục tiêu:** Đặt nhân vật vào không gian thực với sản phẩm.

- Viết prompt mô tả nhân vật **tương tác** với sản phẩm:
  - Ví dụ: cầm nến, ngửi hương, đặt sản phẩm lên bàn, mở hộp...
- Luôn thêm **camera keywords**:
  - `Shot on iPhone 15 Pro`
  - `4k cinematic`
  - `natural daylight` hoặc `golden hour lighting`
  - `shallow depth of field`

---

## Giai đoạn 3: Diễn hoạt Video (Veo 3.1)

**Mục tiêu:** Biến script thành prompt video trông tự nhiên nhất.

- Dựa trên kịch bản nói (Script), thêm **Micro-movements**:
  - `glances at camera while speaking`
  - `subtle hand gestures`
  - `natural lip-sync`
  - `slight head tilt`, `blinks naturally`, `soft smile`
- Chỉ định nhịp độ: `slow pan`, `static shot`, `handheld feel`

---

## Định dạng Output (bắt buộc)

```
Character Persona:
[Tên, tuổi, phong cách sống, đặc điểm ngoại hình]

Master Image Prompt:
[Prompt đầy đủ dùng cho Arcads/Midjourney]

Reference Pack Prompts:
1. Front — [prompt]
2. 3/4 Left — [prompt]
3. Profile — [prompt]
4. Close-up — [prompt]
5. Above-angle — [prompt]

Video Scene Prompt:
[Prompt mô tả hành động, cảm xúc, micro-movements cho Veo 3.1]
```

---

## Ví dụ sản phẩm đã áp dụng
_(cập nhật sau mỗi lần dùng)_

- [ ] —
