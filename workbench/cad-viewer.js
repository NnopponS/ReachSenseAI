import * as THREE from './vendor/three.module.js';
import {parseStl} from './model.js?v=2';

// An illustrative finger only. It is never included in printable exports or
// used to infer anatomical X/Z. The holder and gauge use exact exported STL bytes.
function illustrativeFinger(model) {
  const r=model.diameter_mm/2,positions=[],rings=[];
  rings.push({y:-model.length_mm-10,r});
  for(let i=0;i<=12;i++) {const a=i/12*Math.PI/2;rings.push({y:-6+6*Math.sin(a),r:r*Math.cos(a)});}
  for(let i=0;i<rings.length-1;i++) for(let j=0;j<48;j++) {
    const point=(ring,segment)=>{const a=segment/48*Math.PI*2;
      return [ring.r*Math.cos(a),ring.y,Math.min(model.nail_seat_z_mm,ring.r*Math.sin(a))];};
    const a=point(rings[i],j),b=point(rings[i],j+1),c=point(rings[i+1],j),d=point(rings[i+1],j+1);
    positions.push(...a,...b,...c,...b,...d,...c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d9aa7f',transparent:true,opacity:.48,depthWrite:false,side:THREE.DoubleSide,roughness:1}));
}
export class CadViewer {
  constructor(element) {
    this.element=element;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#eef1e9');
    this.camera=new THREE.PerspectiveCamera(38,1,.1,1000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    element.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#ffffff','#6d8571',2));
    const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(30,70,35);this.scene.add(light);
    this.group=new THREE.Group();this.group.rotation.x=-Math.PI/2;this.scene.add(this.group);
    this.grid=new THREE.GridHelper(100,20,'#bccabd','#dbe3d5');this.scene.add(this.grid);
    this.azimuth=.75;this.elevation=.65;this.distance=75;this.display={gauge:true,finger:true,gap:0};
    let previous=null;
    element.addEventListener('pointerdown',e=>{previous={x:e.clientX,y:e.clientY};element.setPointerCapture(e.pointerId);});
    element.addEventListener('pointermove',e=>{if(!previous)return;this.azimuth-=(e.clientX-previous.x)*.01;
      this.elevation=Math.max(-.4,Math.min(1.55,this.elevation+(e.clientY-previous.y)*.01));previous={x:e.clientX,y:e.clientY};this.render();});
    for(const name of ['pointerup','pointercancel']) element.addEventListener(name,()=>{previous=null;});
    element.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(25,Math.min(180,this.distance*Math.exp(e.deltaY*.001)));this.render();},{passive:false});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(element);this.resize();
  }
  resize() {const width=this.element.clientWidth,height=this.element.clientHeight;
    this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.render();}
  render() {this.camera.position.set(this.distance*Math.sin(this.azimuth)*Math.cos(this.elevation),
    this.distance*Math.sin(this.elevation),this.distance*Math.cos(this.azimuth)*Math.cos(this.elevation));
    this.camera.lookAt(0,0,0);this.renderer.render(this.scene,this.camera);}
  view(name) {if(name==='top'){this.elevation=1.55;this.azimuth=0;}else if(name==='side'){this.elevation=.05;this.azimuth=Math.PI/2;}
    else {this.elevation=.65;this.azimuth=.75;}this.render();}
  options(values) {
    this.display={...this.display,...values};
    if(this.gauge)this.gauge.visible=this.display.gauge;
    if(this.finger){this.finger.visible=this.display.finger;this.finger.position.y=-this.center.y-this.display.gap;}
    this.element.dataset.gaugeVisible=String(this.display.gauge);this.element.dataset.fingerGapMm=String(this.display.gap);
    this.render();
  }
  async show(model,svg) {
    const generation=this.showGeneration=(this.showGeneration||0)+1;
    while(this.group.children.length){const object=this.group.children[0];this.group.remove(object);
      object.geometry?.dispose();object.material?.map?.dispose();object.material?.dispose();}
    this.gauge=null;this.finger=null;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(parseStl(model.mesh_bytes),3));
    geometry.computeVertexNormals();geometry.computeBoundingBox();
    const center=this.center=new THREE.Vector3();geometry.boundingBox.getCenter(center);geometry.translate(-center.x,-center.y,-center.z);
    this.group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#8faa99',roughness:.6,metalness:.02})));
    const gaugeGeometry=new THREE.BufferGeometry();gaugeGeometry.setAttribute('position',new THREE.BufferAttribute(parseStl(model.gauge_bytes),3));
    gaugeGeometry.computeVertexNormals();gaugeGeometry.translate(-center.x,-center.y,-center.z);
    this.gauge=new THREE.Mesh(gaugeGeometry,new THREE.MeshStandardMaterial({color:'#c68d43',roughness:.65}));this.group.add(this.gauge);
    this.finger=illustrativeFinger(model);this.finger.position.set(-center.x,-center.y,-center.z);this.group.add(this.finger);
    const reference=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-model.deck_width_mm/2-center.x,-center.y,-model.diameter_mm/2-center.z),
      new THREE.Vector3(-model.deck_width_mm/2-center.x,-center.y,model.deck_top_z_mm-center.z+3),
      new THREE.Vector3(model.deck_width_mm/2-center.x,-center.y,model.deck_top_z_mm-center.z+3),
      new THREE.Vector3(model.deck_width_mm/2-center.x,-center.y,-model.diameter_mm/2-center.z)]);
    const line=new THREE.Line(reference,new THREE.LineDashedMaterial({color:'#c14e4e',dashSize:1,gapSize:.7}));line.computeLineDistances();this.group.add(line);
    const z=model.marker_center_R_mm[2]+.25;
    const dimension=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-center.x,model.marker_center_R_mm[1]-center.y,z-center.z),
      new THREE.Vector3(-center.x,-center.y,z-center.z)]);
    this.group.add(new THREE.Line(dimension,new THREE.LineBasicMaterial({color:'#376da1'})));
    this.grid.position.y=-model.diameter_mm/2-center.z-.05;
    this.distance=Math.max(model.length_mm+12,model.mesh.bounds_mm[1][0]-model.mesh.bounds_mm[0][0])*2.3;
    this.options(this.display);
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    try {
      const texture=await new THREE.TextureLoader().loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;
      if(generation!==this.showGeneration){texture.dispose();return;}
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(model.tile_edge_mm,model.tile_edge_mm),
        new THREE.MeshStandardMaterial({map:texture,roughness:1,side:THREE.DoubleSide}));
      plane.position.set(-center.x,model.marker_center_R_mm[1]-center.y,model.marker_center_R_mm[2]-center.z+.03);
      this.group.add(plane);
    } finally {URL.revokeObjectURL(url);}
    this.render();
  }
}
