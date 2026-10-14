import './vendor/jszip.min.js';

const dataRoot=new URL('./data/',import.meta.url);
const cache=new Map();
export const hash=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function bytes(path,expected) {
  const url=new URL(path,dataRoot).href;
  if(!cache.has(url)) cache.set(url,(async()=>{
    const response=await fetch(url);
    if(!response.ok) throw new Error('โหลดไฟล์แบบไม่ได้');
    const data=await response.arrayBuffer();
    if(expected && await hash(data)!==expected) throw new Error('ไฟล์แบบไม่ตรงรุ่น กรุณาโหลดหน้าใหม่');
    return data;
  })());
  return cache.get(url);
}
export async function loadCatalog() {
  const response=await fetch(new URL('catalog.json',dataRoot));
  if(!response.ok) throw new Error('โหลดรายการขนาดไม่ได้');
  return response.json();
}
export function validateParameters(values,catalog) {
  const p={};
  for(const [name,defaultValue] of Object.entries(catalog.defaults)) {
    const value=Number(values[name]??defaultValue);
    const choices=name==='edge'?catalog.edges_mm:catalog.diameters_mm;
    if(!choices.includes(value)) throw new Error('เลือกช่องนิ้ว 12–26 มม. และขอบดำ 8–16 มม. ทีละ 0.5 มม.');
    p[name]=value;
  }
  return p;
}
export function markerSvg(id,edge,catalog) {
  const tile=edge+4,cell=edge/6;
  let cells='';
  catalog.marker_bits[id].forEach((row,y)=>row.forEach((bit,x)=>{
    if(bit===0) cells+=`<rect x="${(2+x*cell).toFixed(8)}" y="${(2+y*cell).toFixed(8)}" width="${cell.toFixed(8)}" height="${cell.toFixed(8)}" fill="black"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}mm" height="${tile}mm" viewBox="0 0 ${tile} ${tile}"><rect width="${tile}" height="${tile}" fill="white"/>${cells}</svg>`;
}
function sheetSvg(p,catalog) {
  const tile=p.edge+4,pitch=tile+10,columns=Math.floor(190/pitch);
  let groups='';
  catalog.fingers.forEach((finger,i)=>{
    const cells=markerSvg(finger.id,p.edge,catalog).match(/<rect.*<\/svg>/s)[0].replace('</svg>','');
    groups+=`<g transform="translate(${10+(i%columns)*pitch} ${20+Math.floor(i/columns)*pitch})">${cells}<text x="0" y="${tile+4}" font-size="2.5">ID ${finger.id} | top = +Y</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="white"/><text x="10" y="10" font-size="3">DICT_4X4_100 | print 100%, measure black edges after printing</text>${groups}</svg>`;
}
export function parseStl(data) {
  const view=new DataView(data),count=view.getUint32(80,true);
  if(data.byteLength!==84+count*50 || count>100000) throw new Error('ไฟล์ STL ไม่ถูกต้อง');
  const positions=new Float32Array(count*9);
  for(let i=0;i<count;i++) for(let j=0;j<9;j++) positions[i*9+j]=view.getFloat32(84+i*50+12+j*4,true);
  return positions;
}
async function plate3mf(models,files) {
  let objects='',items='';
  models.forEach((model,i)=>{
    const xyz=parseStl(files.get(model.stl));
    let vertices='',triangles='';const lookup=new Map(),indices=[];
    for(let j=0;j<xyz.length;j+=3) {
      const p=[xyz[j],xyz[j+1],xyz[j+2]].map(n=>Number(n.toFixed(5))),key=p.join(',');
      if(!lookup.has(key)){lookup.set(key,lookup.size);vertices+=`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`;}
      indices.push(lookup.get(key));
    }
    for(let j=0;j<indices.length;j+=3) triangles+=`<triangle v1="${indices[j]}" v2="${indices[j+1]}" v3="${indices[j+2]}"/>`;
    objects+=`<object id="${i+1}" type="model" name="${model.role}-${model.id}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
    items+=`<item objectid="${i+1}" transform="1 0 0 0 1 0 0 0 1 ${30+55*(i%3)} ${40+55*Math.floor(i/3)} 0"/>`;
  });
  const zip=new globalThis.JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file('3D/3dmodel.model',`<?xml version="1.0"?><model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter" xml:lang="en-US"><resources>${objects}</resources><build>${items}</build></model>`);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
export async function prepareKit(values,catalog) {
  const p=validateParameters(values,catalog),files=new Map();
  const [sourceBytes,guideBytes,strap]=await Promise.all([
    bytes('finger-wrap.scad',catalog.assets['finger-wrap.scad'].sha256),
    bytes('guide.th.md',catalog.assets['guide.th.md'].sha256),
    bytes(catalog.strap.file,catalog.strap.sha256)]);
  const source=new TextDecoder().decode(sourceBytes);
  const models=await Promise.all(catalog.fingers.map(async finger=>{
    const diameter=p[`d${finger.id}`],edge=p.edge;
    const entry=catalog.meshes[`d${diameter}-e${edge}`];
    const mesh=await bytes(entry.file,entry.sha256);
    const stl=`${finger.role}-${finger.id}.stl`,scad=`${finger.role}-${finger.id}.scad`,svg=`marker-${finger.id}.svg`;
    files.set(stl,mesh);files.set(svg,markerSvg(finger.id,edge,catalog));
    files.set(scad,source.replace('marker_id = 22;',`marker_id = ${finger.id};`)
      .replace('finger_diameter_mm = 17;',`finger_diameter_mm = ${diameter};`).replace('marker_edge_mm = 10;',`marker_edge_mm = ${edge};`));
    return {...finger,diameter_mm:diameter,marker_edge_mm:edge,white_margin_mm:2,tile_edge_mm:edge+4,
      stl,scad,marker_svg:svg,mesh:entry.mesh,mesh_bytes:mesh,
      marker_center_R_mm:[0,-(3+edge/2),diameter/2+3.15],
      center_to_distal_plane_mm:3+edge/2,deck_width_mm:edge+6,length_mm:edge+14,
      registration_plane_y_mm:0,outer_stop_y_mm:1.2,anatomical_tip_R_mm:null,
      registration_status:'longitudinal-stop-only-xz-unverified'};
  }));
  files.set('finger-wrap.scad',sourceBytes);files.set('วิธีพิมพ์และสวม.th.md',guideBytes);
  files.set('tpu-ladder-strip.stl',strap);files.set('markers-a4.svg',sheetSvg(p,catalog));
  const kit={parameters:p,models,files,catalog};
  kit.exportFile=async name=>{
    if(name==='all-six-holders.3mf' && !files.has(name)) files.set(name,await plate3mf(models,files));
    if(!files.has(name)) throw new Error('ไม่มีไฟล์นี้ในชุดพิมพ์');
    return files.get(name);
  };
  kit.exportZip=async()=>{
    await kit.exportFile('all-six-holders.3mf');
    const manifest={schema_version:1,design_version:catalog.design_version,units:'mm',dictionary:catalog.dictionary,
      parameters:p,source_sha256:catalog.source_sha256,recipe_sha256:catalog.recipe_sha256,
      status:catalog.status,measurement_valid:false,models:models.map(({mesh_bytes,...model})=>model),files:{}};
    for(const [name,value] of files) {
      const data=typeof value==='string'?new TextEncoder().encode(value):value;
      manifest.files[name]={bytes:data.byteLength,sha256:await hash(data)};
    }
    const zip=new globalThis.JSZip();
    for(const [name,data] of files) zip.file(name,data);
    zip.file('manifest.json',JSON.stringify(manifest,null,2));
    return zip.generateAsync({type:'blob',compression:'DEFLATE'});
  };
  return kit;
}
