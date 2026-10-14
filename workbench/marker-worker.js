importScripts('./runtime/opencv.js');
const ready=new Promise((resolve,reject)=>{
  const begin=performance.now();
  const check=()=>{
    if(self.cv?.Mat){resolve();return;}
    if(performance.now()-begin>30000){reject(new Error('โหลด OpenCV เกินเวลา'));return;}
    setTimeout(check,30);
  };check();
});
let detector;
self.onmessage=async({data:m})=>{
  try {
    await ready;
    if(!detector) {
      const dictionary=cv.getPredefinedDictionary(cv.DICT_4X4_100);
      const parameters=new cv.aruco_DetectorParameters();parameters.cornerRefinementMethod=1;
      const refine=new cv.aruco_RefineParameters(10,3,true);
      detector=new cv.aruco_ArucoDetector(dictionary,parameters,refine);
      dictionary.delete();parameters.delete();refine.delete();
    }
    const src=cv.matFromArray(m.height,m.width,cv.CV_8UC4,new Uint8Array(m.pixels));
    const gray=new cv.Mat(),corners=new cv.MatVector(),ids=new cv.Mat(),rejected=new cv.MatVector();
    try {
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);detector.detectMarkers(gray,corners,ids,rejected);
      const markers=[];
      for(let i=0;i<ids.rows;i++) {
        const raw=corners.get(i);const points=Array.from({length:4},(_,j)=>[raw.data32F[j*2],raw.data32F[j*2+1]]);raw.delete();
        const lengths=points.map((p,j)=>Math.hypot(p[0]-points[(j+1)%4][0],p[1]-points[(j+1)%4][1]));
        const area=Math.abs(points.reduce((sum,p,j)=>sum+p[0]*points[(j+1)%4][1]-p[1]*points[(j+1)%4][0],0))/2;
        const id=ids.data32S[i];
        markers.push({id,corners_tl_tr_br_bl_px:points,minimum_edge_px:Math.min(...lengths),area_px2:area,expected:[21,22,23,31,32,33].includes(id)});
      }
      const counts=new Map();for(const marker of markers)counts.set(marker.id,(counts.get(marker.id)||0)+1);
      const rejected_candidates=[];
      for(let i=0;i<rejected.size();i++){const raw=rejected.get(i);rejected_candidates.push(Array.from({length:4},(_,j)=>[raw.data32F[j*2],raw.data32F[j*2+1]]));raw.delete();}
      postMessage({id:m.id,report:{schema_version:1,dictionary:'DICT_4X4_100',opencv_version:'4.13.0',
        processing:'browser-worker',image_width:m.width,image_height:m.height,
        markers:markers.sort((a,b)=>a.id-b.id),duplicate_ids:[...counts].filter(([,count])=>count>1).map(([id])=>id).sort((a,b)=>a-b),
        rejected_candidates,measurement_valid:false,interpretation:'image observations only; no valid 3D measurement'}});
    }finally{src.delete();gray.delete();corners.delete();ids.delete();rejected.delete();}
  }catch(error){postMessage({id:m.id,error:String(error.message??error)});}
};
