# ReachSenseAI: รวมโค้ดและแผน Web เป็นทางหลัก

## สิ่งที่ตรวจพบจากงานเพื่อน

นำประวัติทั้งหมดจาก `imconfusedAFbruh/reachsenseai` ที่ commit
`6ef9a47e5dc94e4e4f4e5454008b09710cee3cce` มาใน `NnopponS/ReachSenseAI`
โดยคงโค้ด Swift/iOS, Python, CAD, artwork, แผนเดิม และ CI เดิมไว้
ไม่มี Android native หรือ Webapp ในต้นทาง จึงไม่ได้มีแอปครบสามแพลตฟอร์มให้ merge

| ส่วน | ทำแล้วในต้นทาง | ยังขาด |
| --- | --- | --- |
| iOS | กล้องหน้า TrueDepth, RGB/depth แบบจับคู่, preview/export | การทดลองจริงกับ iPhone, detector ในแอป, pose/fusion และคะแนน |
| Swift core | unprojection, radial rectification, pair/freshness/lifecycle gates | solver สำหรับปลายนิ้วทั้งคู่และคะแนน |
| Python | อ่าน export, สร้าง ArUco, ตรวจมุม/ID, รายงานภาพ | pose จาก geometry ที่วัดจริง, คะแนนและความแม่นยำ |
| Hardware | CAD/STL ต้นแบบ, marker sheet, geometry สมมติ | ผลิตจริง, วัดขนาด, ทดลองเลื่อน/งอ/สวมใหม่ |
| Android | ไม่มี native code | ใช้ Web ผ่าน browser เป็นทางแรก; native ภายหลังเมื่อมีเหตุผล |
| Web | เพิ่มห้องทดลองใน `workbench/` | วัดอัตโนมัติ, PWA offline, validation บนมือถือจริง |

Ledger เดิมมีลิงก์ CI ที่ระบุ 8 Swift tests และ device/simulator builds ผ่านใน repository เพื่อน
นี่เป็นหลักฐานที่ต้นทางบันทึกไว้ ไม่ใช่ผลที่รันซ้ำบน Linux เครื่องนี้

## ขอบเขตที่ผู้ใช้เลือก

- ใช้กล้องเว็บ/กล้องมือถือทั่วไป ไม่บังคับ TrueDepth
- Marker ที่นิ้วโป้ง กลาง ก้อยของทั้งสองมือ และทดลองเทียบไม้บรรทัดก่อน
- สายรัดจาก 3D print ลักษณะตีนตะขาบ มีช่องใต้ชิ้นส่วนและพันกับนิ้ว
- ใช้ตารางเกณฑ์ตามภาพที่ผู้ใช้ส่งมา แม้ยังไม่มีแหล่งอ้างอิง
- Web เป็นทางหลัก; คง native iOS เป็นอีกเส้นทางทดลอง ไม่แทนที่ข้อกำหนด 3D เดิมเงียบ ๆ

ท่าในภาพคือ back scratch/behind-the-back shoulder flexibility test
ผลขึ้นกับการเคลื่อนไหวของไหล่และแขน รวมถึงท่าลำตัว ไม่ใช่คะแนนความอ่อนตัวของหลังล้วน ๆ

## คำตอบเรื่องกึ่งกลางและขอบ

**เป้าหมายคือปลายนิ้วกลางจริงทั้งสองข้าง ไม่ใช่ระยะระหว่าง marker**

1. ArUco ให้มุม 4 มุมและ ID; ใช้มุมร่วมกับขนาดจริงและแบบจำลองกล้องหา pose
2. กรอบสี่เหลี่ยมตามแนวภาพ (`bounding box`) เปลี่ยนตามมุมหมุน จึงไม่ใช่ขอบทางกายภาพที่ใช้เป็นปลายนิ้ว
3. จุดศูนย์กลาง marker เป็นจุดอ้างอิงที่นิยามได้ แต่ยังต้องชดเชย offset ถึงปลายนิ้ว
4. ถ้าติด marker ขอบเดียวตรงปลายนิ้วจริงและยืนยันตำแหน่งได้ ก็ใช้ขอบที่นิยามในกรอบ marker ได้ แต่ไม่ใช้ขอบของ bounding box อย่างสุ่ม
5. ภายใต้ perspective จุดกึ่งกลาง marker ในภาพคือภาพฉายของศูนย์กลางบนระนาบ marker
   ใช้ homography หรือจุดตัดทแยงมุม; ค่าเฉลี่ยมุมทั้งสี่อาจไม่ใช่จุดนั้น

ตัวอย่าง: ระยะศูนย์กลาง 5 ซม. และแต่ละศูนย์กลางอยู่ห่างปลายนิ้ว 1 ซม. เข้าหากัน
จะเหลือช่องว่างปลายนิ้ว 3 ซม. **เฉพาะเมื่อแนว offset ตรงกันตามตัวอย่างนี้**
ถ้านิ้วหมุน ต้องหมุน offset ไปด้วย ไม่ลบค่าคงที่จากระยะทุกกรณี

ใน 3D: `tip_camera = R_camera_marker × offset_marker + t_camera_marker`
แล้วนำปลายนิ้วทั้งคู่เข้ากรอบเดียวกันที่ผูกกับลำตัว
การวัด offset ครั้งเดียวต่อแบบ/ผู้สวมทำได้ก็ต่อเมื่อการสวมใหม่ให้ตำแหน่งเดิมและนิ้วไม่เลื่อน

## คะแนนที่ต้องแยกกัน

กำหนดแกนลำตัวชี้ขึ้นเป็น `u`:

`signed overlap = dot(tip_lower − tip_upper, u)`

บวก = ซ้อนตามแนวลำตัว, ลบ = ยังมีช่องว่าง, ศูนย์ = ระดับเดียวกัน ไม่ยืนยันการสัมผัส
ระยะเส้นตรง `||tip_lower − tip_upper||` เป็นบวกหรือศูนย์เสมอ จึงใช้แทนคะแนนซ้อนไม่ได้
ต้องเก็บความเหลื่อมด้านข้างและความลึกแยกกัน

ภาพตัวอย่างเส้นเฉียงอาจสื่อระยะตรงตอนยังไม่ถึงกัน ขณะที่ต้นทางเลือก projected overlap
การใช้ตารางกับ projected overlap ยังเป็นสมมติฐานที่ต้องเทียบวิธีวัดจริงก่อนสรุป
Web รุ่นนี้แสดงทั้ง projected overlap ในภาพและระยะตรงในภาพ เพื่อไม่ปนสองนิยาม

## เหตุผลที่ marker 6 จุดไม่ได้แก้ทุกปัญหา

- นิ้วโป้ง กลาง ก้อยไม่เป็นวัตถุแข็งร่วมกัน เมื่อปลายนิ้วกลางถูกบัง ห้ามประมาณจากนิ้วอื่นด้วย offset คงที่
- Marker ที่โค้งบนสายรัดไม่ตรงสมมติฐานสี่เหลี่ยมแบนของ ArUco ควรมีแผ่นหน้า marker ที่แข็งและแบน
- นิ้วกลางสองข้างซ้อนกันแล้วบัง marker ได้ ควรทดลองหน้าด้านข้าง/หลายหน้าของ **นิ้วกลางเดียวกัน** หรือเปลี่ยนมุมกล้อง
- MediaPipe ช่วยเสนอ landmark และตรวจท่าทางได้ แต่ต้องตรวจความมั่นใจ การบัง และความถูกต้องเทียบ manual reference
- ค่า world landmarks ของ MediaPipe มี origin ที่ศูนย์กลางมือแต่ละมือ ห้ามลบพิกัดสองมือแล้วถือว่าเป็นระยะโลกเดียวกันโดยไม่ลงทะเบียนกรอบร่วม
- ArUco ขนาดจริงช่วยเรื่อง scale แต่ไม่ทำให้ camera intrinsics, lens distortion และความต่างความลึกหายไป
  กล้องทั่วไปไม่รับประกันเซนติเมตรที่แม่นโดยไม่มี calibration/สมมติฐาน/การทดลอง

## สิ่งที่ Web รุ่นแรกทำจริง

เปิดกล้องหรืออัปโหลดภาพ → ตรวจ ArUco → หยุดภาพ → แตะช่วงไม้บรรทัด 2 จุด
และปลายนิ้วจริง 2 จุด → กำหนดแนวลำตัว → ตรวจสมมติฐานระนาบ → แสดงค่าประมาณ → export JSON

- ไม่บันทึกภาพบนเซิร์ฟเวอร์; ภาพส่งไปยังเซิร์ฟเวอร์ของ Web เพื่อประมวลผลในหน่วยความจำ
- ไม่ได้วัดอัตโนมัติและยังไม่มี MediaPipe; ค่า `measurement_valid` เป็น `false` เสมอ
- ต้องเห็นปลายนิ้วจริง ไม่ใช้ marker center แทนเมื่อปลายนิ้วถูกบัง
- เก็บ raw score, จุดที่เลือก, สเกล, มุม, ID/corners, hash ของ PNG หลังย่อขนาด, เวอร์ชันเกณฑ์ และ flag ภาพจำลอง
- กล้องมือถือใช้ HTTPS; UI responsive แต่ยังไม่ได้รับรอง Android/iOS browser บนอุปกรณ์จริง
- Marker profile ใหม่: ซ้าย 21/22/23 = โป้ง/กลาง/ก้อย, ขวา 31/32/33 ตามลำดับ
  profile นี้ใช้ ID ชุดเดียวกับ artwork เดิม แต่ **ความหมายต่างจากสามหน้าบนนิ้วกลางใน iOS** ห้ามใช้ calibration ข้าม profile

## ตารางตามภาพ: เก็บเครื่องหมายเดิม

| มืออยู่บน | เกณฑ์ | ต่ำกว่า | มาตรฐาน | สูงกว่า |
| --- | --- | --- | --- | --- |
| ขวา | ชาย | <4 | 4–5.9 | >6 |
| ขวา | หญิง | <5 | 5–6.9 | >7 |
| ซ้าย | ชาย | <0 | 0–2.9 | >3 |
| ซ้าย | หญิง | <0 | 0–5.9 | >6 |

ตารางไม่มีแหล่งอ้างอิง ช่วงเช่น `(5.9, 6]` ยังไม่ระบุ
ระบบแสดงว่าเป็นช่วงรอยต่อ ไม่เปลี่ยน `>6` เป็น `≥6` เอง
เปรียบเทียบด้วยค่าที่ยังไม่ปัดเศษ การแสดง 2 ตำแหน่งไม่ได้เป็นคำกล่าวอ้างความละเอียด/ความแม่นยำ
เกณฑ์ยังไม่บอกอายุ ประชากร ท่าวัด นิยามระยะ และข้อจำกัดของอุปกรณ์

## งานต่อไปตามลำดับ พร้อมเกณฑ์จบงาน

| ระยะ | งาน | หลักฐานที่ต้องได้ |
| --- | --- | --- |
| A — baseline (เริ่มแล้ว) | Web ทดลอง + manual tips/ruler + detection | คะแนนบวก/ลบและขอบเกณฑ์ถูกต้อง, ภาพจริงเทียบไม้บรรทัด |
| B — สายรัด | ออกแบบฐาน marker แบน มีความหมาย ID/ด้าน/แนวชัด ไม่บังคับท่านิ้ว | วัด black edge และ offset จริง; สวมซ้ำ/งอนิ้ว/พันหลวมแน่นแล้ววัด drift; ทดสอบการซ้อนและการบัง |
| C — automatic 2D | เลือก middle IDs; ใช้ calibrated marker-to-tip transform; MediaPipe เป็นตัวช่วยตรวจสอบ | endpoint ที่คำนวณเทียบ manual ที่ไม่ได้ใช้เป็นข้อมูล calibrate; บัง marker ต้องหยุดให้คะแนน |
| D — camera/3D decision | เทียบ low-calibration 2D กับ calibrated monocular pose | error แยกตาม depth, rotation, ระยะกล้อง, device; ถ้าเกินเป้าที่ตกลง ต้องเพิ่ม calibration/กล้องอีกมุม/เซนเซอร์ |
| E — session UX | checklist, ตรวจสวม, stable window, 3 valid trials, timeout/rejection/export | ทดลองใช้งานจริง; stale/missing observations ไม่ผ่าน; ไม่มี session score ถ้าครบไม่พอ |
| F — validation | ระยะ gap/overlap ที่อ้างอิงอิสระและมนุษย์ตาม protocol ที่ตกลง | MAE/bias/SD/อัตราวัดไม่ได้ + วิธีวัดเทียบเกณฑ์ที่ตรงกัน |

แผน baseline: ใช้แท่นหรือ mock fingers กับค่าจริง −10, −5, −1, 0, +1, +5, +10 ซม.
เพิ่ม lateral offset, depth offset, กล้องเอียง, marker หมุน, บังบางส่วน/ทั้งหมด
วัดซ้ำในหลายวันและสวมใหม่หลายครั้ง แยกชุด calibrate ออกจากชุดประเมิน
เป้าเดิม MAE ≤5 mm, bias ≤2 mm, SD ≤2 mm เป็น **เป้าที่ต้องทดสอบ** ไม่ใช่ผลที่ทำได้แล้ว
การเลือกว่าพัฒนา 2D ต่อได้หรือไม่ขึ้นกับผลชุดนี้ ไม่ใช่การเลือก framework

## หลักฐานและเอกสารทางเทคนิค

อ่าน source เอกสารหลักผ่าน GitHub เพราะเว็บไซต์เอกสารตรงยังไม่อยู่ใน allowlist:

1. [OpenCV 4.13 ArUco tutorial source](https://github.com/opencv/opencv/blob/4.13.0/doc/tutorials/objdetect/aruco_detection/aruco_detection.markdown): corner ordering, marker frame origin, camera matrix/distortion และ pose units
2. [MediaPipe Hands official source documentation](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md): normalized image landmarks, per-hand world origin และ mirrored handedness; เอกสารนี้เป็น API รุ่นเดิม จึงต้องตรวจ current Hand Landmarker API อีกครั้งก่อน integration
3. [MDN getUserMedia source](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediadevices/getusermedia/index.md): HTTPS/localhost และ camera permission
4. [แนวคิด score เดิม](adr/0002-use-projected-overlap-as-the-primary-score.md), [ข้อกำหนด multi-face เดิม](adr/0003-track-multi-face-rigid-bodies-and-virtual-tips.md)

อย่าสรุปว่า marker 6 จุดหรือการประเมิน 2D เทียบเท่า native research instrument ก่อนมีหลักฐาน
