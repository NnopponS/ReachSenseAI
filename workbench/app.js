import {estimate} from './measurement.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d'), video = $('video');
let frame = null, points = [], observations = null, stream = null, live = false;
let revision = 0, controller = null, timer = null, result = null, synthetic = false;
let sourceHash = null;
const records = [];
const say = message => { $('status').textContent = message; };

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;
  ctx.drawImage(frame, 0, 0);
  ctx.lineWidth = Math.max(2, canvas.width/400);
  ctx.font = `${Math.max(16, canvas.width/50)}px system-ui`;
  for (const marker of observations?.markers ?? []) {
    const corners = marker.corners_tl_tr_br_bl_px;
    ctx.strokeStyle = '#087b65'; ctx.fillStyle = '#087b65';
    ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.stroke();
    // Diagonal intersection is the projective image of the planar square center.
    const [a, b, c, d] = corners;
    const ux=c[0]-a[0], uy=c[1]-a[1], vx=d[0]-b[0], vy=d[1]-b[1];
    const denominator=ux*vy-uy*vx;
    if (Math.abs(denominator)>1e-8) {
      const t=((b[0]-a[0])*vy-(b[1]-a[1])*vx)/denominator;
      ctx.beginPath(); ctx.arc(a[0]+t*ux,a[1]+t*uy,4,0,2*Math.PI); ctx.fill();
    }
    ctx.fillText(`ID ${marker.id}`, corners[0][0], Math.max(20, corners[0][1]-8));
  }
  points.forEach((p, i) => {
    ctx.fillStyle = i < 2 ? '#bd6b17' : '#b63464'; ctx.strokeStyle = 'white';
    ctx.beginPath(); ctx.arc(p.x,p.y,7,0,2*Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillText(String(i+1),p.x+12,p.y-10);
    if (i===1 || i===3) {
      ctx.strokeStyle = i===1 ? '#bd6b17' : '#b63464';
      ctx.beginPath(); ctx.moveTo(points[i-1].x,points[i-1].y); ctx.lineTo(p.x,p.y); ctx.stroke();
    }
  });
}

function update() {
  $('empty').hidden = Boolean(frame);
  $('freeze').disabled = !live; $('stop').disabled = !stream;
  $('undo').disabled = !points.length || live;
  for (const [i, li] of [...$('steps').children].entries()) {
    li.className = i < points.length ? 'done' : i===points.length ? 'active' : '';
  }
  const ids = observations?.markers.map(m => m.id) ?? [];
  $('markers').textContent = observations ?
    `พบ ${ids.length} marker: ${ids.join(', ') || 'ไม่มี'}${observations.duplicate_ids.length ? ' · พบ ID ซ้ำ: '+observations.duplicate_ids.join(', ') : ''} · เป็นข้อมูลภาพ ยังไม่ใช่คะแนน` : 'ตรวจ ArUco: รอภาพ';
  result = null;
  if (frame && !live && points.length===4) {
    try {
      result = estimate({points, rulerCm: Number($('ruler').value), bodyAngleDeg: Number($('angle').value),
        samePlane:$('plane').checked, sex:$('sex').value, position:$('position').value});
      $('meaning').textContent = synthetic ? 'ภาพจำลอง · ใช้ทดสอบซอฟต์แวร์เท่านั้น' :
        result.signed_overlap_cm > 0 ? 'ปลายนิ้วซ้อนตามแนวลำตัวในภาพ' :
        result.signed_overlap_cm < 0 ? 'ปลายนิ้วยังห่างตามแนวลำตัวในภาพ' : 'อยู่ระดับเดียวกันในภาพ ไม่ยืนยันการสัมผัส';
    } catch (error) { $('meaning').textContent = error.message; }
  } else $('meaning').textContent = live ? 'หยุดภาพก่อนเลือกจุดวัด' : 'เลือกภาพและจุดให้ครบก่อน';
  $('score').replaceChildren(document.createTextNode(result ? `${result.signed_overlap_cm >= 0 ? '+' : ''}${result.signed_overlap_cm.toFixed(2)} ` : '— '));
  const unit = document.createElement('span'); unit.textContent = 'ซม.'; $('score').append(unit);
  $('lateral').textContent = result ? `${result.lateral_offset_cm.toFixed(2)} ซม.` : '—';
  $('distance').textContent = result ? `${result.image_plane_distance_cm.toFixed(2)} ซม.` : '—';
  $('category').textContent = result ? result.category : '—';
  $('save').disabled = !result;
  render();
}

function invalidate() {
  revision++; clearTimeout(timer); controller?.abort(); controller=null;
}

function stopCamera() {
  invalidate(); live=false;
  stream?.getTracks().forEach(track=>track.stop()); stream=null; video.srcObject=null;
  $('camera').disabled=false;
  update();
}

function newFrame(image, isDemo=false) {
  const w=image.videoWidth || image.width, h=image.videoHeight || image.height;
  const scale=Math.min(1,1280/w,1280/h);
  const snapshot=document.createElement('canvas');
  snapshot.width=Math.round(w*scale); snapshot.height=Math.round(h*scale);
  snapshot.getContext('2d').drawImage(image,0,0,snapshot.width,snapshot.height);
  frame=snapshot; canvas.width=frame.width; canvas.height=frame.height;
  points=[]; observations=null; result=null; synthetic=isDemo; sourceHash=null;
  $('plane').checked=false;
  $('sourceStatus').textContent = isDemo ? 'ภาพจำลอง' : live ? 'กล้องกำลังทำงาน' : 'ภาพนิ่ง';
  update();
}

async function detect(myRevision) {
  const captured=frame;
  const blob=await new Promise(resolve=>captured.toBlob(resolve,'image/png'));
  if (myRevision!==revision || !blob) return;
  const currentController=new AbortController(); controller=currentController;
  try {
    const response=await fetch('/api/observe',{method:'POST',headers:{'Content-Type':'image/png'},body:blob,signal:currentController.signal});
    const report=await response.json();
    if (myRevision!==revision) return;
    if (!response.ok) throw new Error(report.error);
    observations=report;
    if (!live && globalThis.crypto?.subtle) {
      const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      if (myRevision!==revision) return;
      sourceHash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    say(live ? 'ตรวจภาพกล้อง · ไม่มีการเก็บภาพ · หยุดภาพเมื่อพร้อมวัด' : 'แตะ 4 จุดตามลำดับ · ถ้าปลายนิ้วถูกบัง ให้เปลี่ยนภาพ');
    update();
  } catch(error) {
    if (myRevision===revision && error.name!=='AbortError') {
      observations=null; say(`ตรวจ marker ไม่สำเร็จ: ${error.message} · ยังเลือกจุดด้วยมือได้`); update();
    }
  } finally { if(controller===currentController) controller=null; }
}

async function liveLoop(myRevision) {
  if (!live || myRevision!==revision) return;
  if (video.readyState>=2) { newFrame(video); await detect(myRevision); }
  if (live && myRevision===revision) timer=setTimeout(()=>liveLoop(myRevision),400);
}

$('camera').addEventListener('click',async()=>{
  stopCamera(); const myRevision=revision;
  $('camera').disabled=true; say('กำลังขออนุญาตกล้อง…');
  let candidate=null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('กล้องต้องเปิดผ่าน HTTPS หรือ localhost; ใช้เลือกภาพได้');
    candidate=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    if(myRevision!==revision) {candidate.getTracks().forEach(t=>t.stop()); return;}
    stream=candidate; video.srcObject=stream; await video.play();
    if(myRevision!==revision) return;
    live=true; update(); liveLoop(myRevision);
  } catch(error) {
    candidate?.getTracks().forEach(t=>t.stop());
    if(myRevision===revision) { stopCamera(); say(`เปิดกล้องไม่ได้: ${error.message} · เลือกภาพแทนได้`); }
  }
});
$('freeze').addEventListener('click',()=>{
  invalidate(); live=false; newFrame(video); say('หยุดภาพแล้ว · เลือกจุดวัดตามลำดับ'); detect(revision);
});
$('stop').addEventListener('click',()=>{stopCamera();say('ปิดกล้องแล้ว');});

async function loadBlob(blob,isDemo) {
  stopCamera(); const myRevision=revision;
  try {
    const image=await createImageBitmap(blob);
    if(myRevision!==revision) {image.close();return;}
    newFrame(image,isDemo); image.close(); await detect(myRevision);
  } catch(error) { if(myRevision===revision) say(`อ่านภาพไม่ได้: ${error.message}`); }
}
$('upload').addEventListener('change',()=>{
  const file=$('upload').files[0]; $('upload').value='';
  if (!file) return;
  if (file.size>8*1024*1024 || !['image/png','image/jpeg'].includes(file.type)) {say('เลือก PNG/JPEG ไม่เกิน 8 MB');return;}
  loadBlob(file,false);
});
$('demo').addEventListener('click',async()=>{
  stopCamera(); const myRevision=revision;
  try {
    const response=await fetch('/api/demo.png');
    if (!response.ok) throw new Error('โหลดภาพจำลองไม่ได้');
    const blob=await response.blob(); if(myRevision===revision) await loadBlob(blob,true);
  } catch(error) {if(myRevision===revision) say(error.message);}
});
canvas.addEventListener('click',event=>{
  if (!frame || live || points.length>=4) return;
  const rect=canvas.getBoundingClientRect();
  points.push({x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height});
  update();
});
$('undo').addEventListener('click',()=>{points.pop();update();});
$('reset').addEventListener('click',()=>{points=[];$('plane').checked=false;update();});
['sex','position','ruler','angle','plane'].forEach(id=>$(id).addEventListener('input',update));
$('save').addEventListener('click',()=>{
  if (!result) return;
  records.push({...result,timestamp:new Date().toISOString(),synthetic,source_sha256:sourceHash,
    source_dimensions_px:[canvas.width,canvas.height],points_px:points.map(p=>({...p})),
    ruler_cm:Number($('ruler').value),body_angle_deg:Number($('angle').value),
    sex:$('sex').value,hand_up:$('position').value,markers:observations?.markers ?? [],
    category_source:'user-supplied-image-without-citation'});
  $('records').textContent=`เก็บแล้ว ${records.length} ค่าทดลอง · ${records.filter(r=>r.synthetic).length} จากภาพจำลอง`;
  $('export').disabled=false; say('เก็บค่าในหน่วยความจำแล้ว · ส่งออกก่อนปิดหน้า');
});
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({schema_version:1,measurement_valid:false,records},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download='reachsense-experiments.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('pagehide',stopCamera);
update();
