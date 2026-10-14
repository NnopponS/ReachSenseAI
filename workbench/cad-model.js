import './vendor/jszip.min.js';

// Version the data path as well as scripts: a cached v1 client must never
// combine its old 8 mm metadata with the v2 11 mm physical geometry.
const dataRoot=new URL('./data-v2/',import.meta.url);
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
  const catalog=await response.json();
  if(catalog.schema_version!==2) throw new Error('แบบคนละรุ่น กรุณาโหลดหน้าใหม่');
  return catalog;
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
async function plate3mf(parts,files) {
  let objects='',items='';
  parts.forEach((name,i)=>{
    const xyz=parseStl(files.get(name));
    let vertices='',triangles='';const lookup=new Map(),indices=[];
    for(let j=0;j<xyz.length;j+=3) {
      const p=[xyz[j],xyz[j+1],xyz[j+2]].map(n=>Number(n.toFixed(5))),key=p.join(',');
      if(!lookup.has(key)){lookup.set(key,lookup.size);vertices+=`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`;}
      indices.push(lookup.get(key));
    }
    for(let j=0;j<indices.length;j+=3) triangles+=`<triangle v1="${indices[j]}" v2="${indices[j+1]}" v3="${indices[j+2]}"/>`;
    const lowestZ=Math.min(...Array.from(lookup.keys(),key=>Number(key.split(',')[2])));
    objects+=`<object id="${i+1}" type="model" name="${name}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
    items+=`<item objectid="${i+1}" transform="1 0 0 0 1 0 0 0 1 ${30+55*(i%3)} ${40+40*Math.floor(i/3)} ${-lowestZ}"/>`;
  });
  const zip=new globalThis.JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file('3D/3dmodel.model',`<?xml version="1.0"?><model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter" xml:lang="en-US"><resources>${objects}</resources><build>${items}</build></model>`);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
export async function prepareKit(values,catalog) {
  const p=validateParameters(values,catalog),files=new Map();
  const [sourceBytes,guideBytes,strap,fitCheck]=await Promise.all([
    bytes('finger-wrap.scad',catalog.assets['finger-wrap.scad'].sha256),
    bytes('guide.th.md',catalog.assets['guide.th.md'].sha256),
    bytes(catalog.strap.file,catalog.strap.sha256),
    bytes('fit-check.csv',catalog.assets['fit-check.csv'].sha256)]);
  const source=new TextDecoder().decode(sourceBytes);
  const models=await Promise.all(catalog.fingers.map(async finger=>{
    const diameter=p[`d${finger.id}`],edge=p.edge;
    const entry=catalog.meshes[`d${diameter}-e${edge}`];
    const [mesh,gauge]=await Promise.all([bytes(entry.file,entry.sha256),bytes(entry.gauge.file,entry.gauge.sha256)]);
    const stl=`${finger.role}-${finger.id}.stl`,scad=`${finger.role}-${finger.id}.scad`,svg=`marker-${finger.id}.svg`;
    files.set(stl,mesh);files.set(svg,markerSvg(finger.id,edge,catalog));
    const preset=source.replace('marker_id = 22;',`marker_id = ${finger.id};`)
      .replace('finger_diameter_mm = 17;',`finger_diameter_mm = ${diameter};`).replace('marker_edge_mm = 10;',`marker_edge_mm = ${edge};`);
    const gaugeStl=`${finger.role}-${finger.id}-seating-gauge.stl`,gaugeScad=`${finger.role}-${finger.id}-seating-gauge.scad`;
    files.set(scad,preset);files.set(gaugeStl,gauge);
    files.set(gaugeScad,preset.replace('part = "holder";', 'part = "gauge";'));
    return {...finger,diameter_mm:diameter,...entry.geometry,
      stl,scad,marker_svg:svg,mesh:entry.mesh,mesh_bytes:mesh,
      gauge_stl:gaugeStl,gauge_scad:gaugeScad,gauge_mesh:entry.gauge.mesh,gauge_bytes:gauge};
  }));
  files.set('finger-wrap.scad',sourceBytes);files.set('วิธีพิมพ์และสวม.th.md',guideBytes);
  files.set('tpu-ladder-strip.stl',strap);files.set('markers-a4.svg',sheetSvg(p,catalog));
  files.set('fit-check.csv',fitCheck);
  const kit={parameters:p,models,files,catalog};
  kit.exportFile=async name=>{
    if(name==='all-six-holders-and-gauges.3mf' && !files.has(name))
      files.set(name,await plate3mf(models.flatMap(m=>[m.stl,m.gauge_stl]),files));
    const selected=models.find(m=>name===`${m.role}-${m.id}-fit-pair.3mf`);
    if(selected && !files.has(name)) files.set(name,await plate3mf([selected.stl,selected.gauge_stl],files));
    if(!files.has(name)) throw new Error('ไม่มีไฟล์นี้ในชุดพิมพ์');
    return files.get(name);
  };
  kit.exportZip=async()=>{
    await kit.exportFile('all-six-holders-and-gauges.3mf');
    for(const m of models) await kit.exportFile(`${m.role}-${m.id}-fit-pair.3mf`);
    const manifest={schema_version:2,design_version:catalog.design_version,units:'mm',dictionary:catalog.dictionary,
      parameters:p,source_sha256:catalog.source_sha256,recipe_sha256:catalog.recipe_sha256,
      status:catalog.status,measurement_valid:false,
      calibration_required:'Gauge fit, removal drift, remount repeatability and anatomical X/Z remain unverified',
      models:models.map(({mesh_bytes,gauge_bytes,...model})=>model),files:{}};
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
