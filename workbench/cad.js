import {loadCatalog,prepareKit,markerSvg} from './model.js';
import {CadViewer} from './viewer.js';

const $=id=>document.getElementById(id);
let catalog,kit,viewer,selected=22,generation=0,dirty=false;
const links=['downloadPlate','downloadSheet','downloadStrap','downloadGuide','downloadStl','downloadScad','downloadMarker'];
const say=text=>{$('cadStatus').textContent=text;};
const enabled=value=>{ $('downloadKit').disabled=!value;links.forEach(id=>$(id).setAttribute('aria-disabled',String(!value))); };
function values(){return {edge:Number($('markerEdge').value),...Object.fromEntries(catalog.fingers.map(f=>[`d${f.id}`,Number($(`d${f.id}`).value)]))};}
function download(data,name,mime='application/octet-stream') {
  const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type:mime}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function dirtyForm(){dirty=true;enabled(false);say('ขนาดเปลี่ยนแล้ว กดอัปเดตแบบก่อนดาวน์โหลด');}
function cards() {
  for(const f of [21,31,22,32,23,33].map(id=>catalog.fingers.find(f=>f.id===id))) {
    const card=document.createElement('div');card.className='finger-card';card.dataset.id=f.id;
    const button=document.createElement('button');button.className='finger-select';button.type='button';
    const image=document.createElement('img');image.alt=`ArUco ${f.id}`;
    image.src=URL.createObjectURL(new Blob([markerSvg(f.id,catalog.defaults.edge,catalog)],{type:'image/svg+xml'}));
    const span=document.createElement('span');span.textContent=f.label;
    const strong=document.createElement('strong');strong.textContent=`ID ${f.id}`;span.append(strong);button.append(image,span);
    button.addEventListener('click',()=>{selected=f.id;showSelection();});
    const label=document.createElement('label');label.textContent='ช่องนิ้ว (มม.)';
    const input=document.createElement('input');input.type='number';input.min='12';input.max='26';input.step='0.5';input.id=`d${f.id}`;
    input.value=catalog.defaults[`d${f.id}`];input.addEventListener('input',dirtyForm);label.append(input);card.append(button,label);$('fingerCards').append(card);
  }
}
async function showSelection() {
  if(!kit)return;
  const model=kit.models.find(m=>m.id===selected);
  $('modelTitle').textContent=model.label;$('modelTag').textContent=`ID ${model.id}`;
  $('metricDiameter').textContent=`${model.diameter_mm} มม.`;$('metricEdge').textContent=`${model.marker_edge_mm} มม.`;
  $('metricOffset').textContent=`${model.center_to_distal_plane_mm} มม.`;
  $('selectedFileLabel').textContent=`${model.label} · ID ${model.id}`;
  document.querySelectorAll('.finger-card').forEach(card=>{card.classList.toggle('active',Number(card.dataset.id)===selected);
    card.querySelector('button').setAttribute('aria-pressed',String(Number(card.dataset.id)===selected));});
  if(viewer){await viewer.show(model,kit.files.get(model.marker_svg));$('viewerStatus').hidden=true;}
}
async function apply() {
  const current=++generation;$('apply').disabled=true;enabled(false);say('กำลังเตรียม STL และ artwork ให้ตรงขนาด…');
  try {
    const next=await prepareKit(values(),catalog);if(current!==generation)return;
    kit=next;dirty=Object.entries(next.parameters).some(([name,value])=>values()[name]!==value);
    await showSelection();enabled(!dirty);say(dirty?'ขนาดเปลี่ยนระหว่างโหลด กดอัปเดตแบบอีกครั้ง':'พร้อมดาวน์โหลด · ไฟล์และแบบ 3D ใช้ขนาดชุดเดียวกัน');
  } catch(error){say(error.message);}
  finally{if(current===generation)$('apply').disabled=false;}
}
async function file(name,mime) {
  if(!kit||dirty)return;
  try{download(await kit.exportFile(name),name,mime);}catch(error){say(error.message);}
}
$('downloadKit').addEventListener('click',async()=>{
  if(!kit||dirty)return;const current=kit;$('downloadKit').disabled=true;say('กำลังจัดชุด STL, 3MF, CAD และ marker ทั้ง 6…');
  try{download(await current.exportZip(),'reachsense-six-finger-kit.zip','application/zip');say('ดาวน์โหลดชุดแล้ว · พิมพ์หน่วย mm และตรวจขอบดำจริง');}
  catch(error){say(error.message);}finally{enabled(!dirty);}
});
const actions={downloadPlate:()=>file('all-six-holders.3mf','model/3mf'),downloadSheet:()=>file('markers-a4.svg','image/svg+xml'),
  downloadStrap:()=>file('tpu-ladder-strip.stl','model/stl'),downloadGuide:()=>file('วิธีพิมพ์และสวม.th.md','text/markdown'),
  downloadStl:()=>file(kit.models.find(m=>m.id===selected).stl,'model/stl'),
  downloadScad:()=>file(kit.models.find(m=>m.id===selected).scad,'text/plain'),
  downloadMarker:()=>file(kit.models.find(m=>m.id===selected).marker_svg,'image/svg+xml')};
for(const [id,action] of Object.entries(actions)) {
  $(id).href='#';$(id).addEventListener('click',e=>{e.preventDefault();if(!dirty&&kit)action();});
}
for(const [id,name] of [['viewIso','iso'],['viewTop','top'],['viewSide','side']])$(id).addEventListener('click',()=>viewer?.view(name));
$('apply').addEventListener('click',apply);$('markerEdge').addEventListener('input',dirtyForm);
try {
  catalog=await loadCatalog();cards();
  try{viewer=new CadViewer($('viewer'));}catch{$('viewerStatus').textContent='อุปกรณ์นี้ไม่รองรับภาพ 3D แต่ดาวน์โหลดไฟล์พิมพ์ได้';}
  await apply();
}catch(error){say(error.message);$('viewerStatus').textContent=error.message;}
