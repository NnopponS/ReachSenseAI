// Image-plane estimates only. Never substitute marker centers for anatomical tips.
export const REFERENCE_VERSION = 'user-image-v1-unverified';

export function categoryFor(score, sex, position) {
  if (!Number.isFinite(score) || !['male', 'female'].includes(sex) ||
      !['right', 'left'].includes(position)) throw new Error('ข้อมูลเกณฑ์ไม่ถูกต้อง');
  const ranges = {
    'male-right': [4, 5.9, 6], 'female-right': [5, 6.9, 7],
    'male-left': [0, 2.9, 3], 'female-left': [0, 5.9, 6],
  };
  const [low, standardMax, high] = ranges[`${sex}-${position}`];
  if (score < low) return 'ต่ำกว่า';
  if (score <= standardMax) return 'มาตรฐาน';
  if (score > high) return 'สูงกว่า';
  return 'ช่วงรอยต่อที่ตารางไม่ได้ระบุ';
}

export function estimate({points, rulerCm, bodyAngleDeg = 0, samePlane, sex, position}) {
  if (!samePlane) throw new Error('ต้องตรวจว่าไม้บรรทัดและปลายนิ้วอยู่ใกล้ระนาบเดียวกันก่อน');
  if (!Array.isArray(points) || points.length !== 4 || points.some(p =>
    !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('เลือกให้ครบ 4 จุด');
  if (!Number.isFinite(rulerCm) || rulerCm <= 0 || rulerCm > 100 ||
      !Number.isFinite(bodyAngleDeg) || Math.abs(bodyAngleDeg) > 90) throw new Error('ขนาดหรือมุมไม่ถูกต้อง');
  const [r0, r1, upper, lower] = points;
  const rulerPx = Math.hypot(r1.x-r0.x, r1.y-r0.y);
  if (rulerPx < 20) throw new Error('เลือกช่วงไม้บรรทัดให้ยาวอย่างน้อย 20 พิกเซล');
  const cmPerPx = rulerCm/rulerPx;
  const angle = bodyAngleDeg*Math.PI/180;
  // Body-up axis: (sin(angle), -cos(angle)); image y points downward.
  const dx = lower.x-upper.x, dy = lower.y-upper.y;
  const score = (dx*Math.sin(angle)-dy*Math.cos(angle))*cmPerPx;
  const lateral = (dx*Math.cos(angle)+dy*Math.sin(angle))*cmPerPx;
  return {
    signed_overlap_cm: score, lateral_offset_cm: lateral,
    image_plane_distance_cm: Math.hypot(dx, dy)*cmPerPx,
    category: categoryFor(score, sex, position), reference_version: REFERENCE_VERSION,
    method: 'manual-image-plane-ruler', measurement_valid: false,
    assumptions: ['same-plane', 'weak-perspective', 'manual-anatomical-endpoints', 'manual-body-axis'],
  };
}
