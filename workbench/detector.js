export class MarkerDetector {
  constructor() {
    this.worker=new Worker(new URL('./marker-worker.js',import.meta.url));this.pending=new Map();this.id=0;
    this.worker.onmessage=({data})=>{
      const request=this.pending.get(data.id);if(!request)return;
      clearTimeout(request.timeout);this.pending.delete(data.id);
      if(data.error)request.reject(new Error(data.error));else request.resolve(data.report);
    };
    this.worker.onerror=event=>this.fail(event.message||'โหลด OpenCV ไม่สำเร็จ');
  }
  fail(message){for(const request of this.pending.values()){clearTimeout(request.timeout);request.reject(new Error(message));}this.pending.clear();}
  observe(canvas) {
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const id=++this.id;
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.pending.delete(id);reject(new Error('ประมวลผล marker เกินเวลา'));},40000);
      this.pending.set(id,{resolve,reject,timeout});
      this.worker.postMessage({id,width:canvas.width,height:canvas.height,pixels:pixels.buffer},[pixels.buffer]);
    });
  }
  dispose(){this.fail('ปิดตัวตรวจ marker');this.worker.terminate();}
}
