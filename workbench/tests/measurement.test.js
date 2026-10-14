import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,categoryFor} from '../measurement.js';

const input={points:[{x:0,y:0},{x:100,y:0},{x:40,y:100},{x:40,y:140}],
  rulerCm:10,samePlane:true,sex:'male',position:'right'};
test('known 4 cm gap is negative; an overlap is positive and retains lateral offset',()=>{
  const gap=estimate(input); assert.equal(gap.signed_overlap_cm,-4);
  assert.equal(gap.image_plane_distance_cm,4); assert.equal(gap.measurement_valid,false);
  const overlap=estimate({...input,points:[...input.points.slice(0,3),{x:70,y:60}]});
  assert.equal(overlap.signed_overlap_cm,4); assert.equal(overlap.lateral_offset_cm,3);
  assert.equal(overlap.image_plane_distance_cm,5);
});
test('equal vertical coordinates do not mean touching',()=>{
  const r=estimate({...input,points:[...input.points.slice(0,3),{x:70,y:100}]});
  assert.equal(r.signed_overlap_cm,0); assert.equal(r.image_plane_distance_cm,3);
});
test('body rotation changes signed projection without changing straight distance',()=>{
  const r=estimate({...input,bodyAngleDeg:90,points:[...input.points.slice(0,3),{x:80,y:100}]});
  assert.equal(r.signed_overlap_cm,4); assert.equal(r.image_plane_distance_cm,4);
});
test('missing assumptions, degenerate ruler and invalid coordinates cannot yield a score',()=>{
  assert.throws(()=>estimate({...input,samePlane:false}));
  assert.throws(()=>estimate({...input,rulerCm:0}));
  assert.throws(()=>estimate({...input,bodyAngleDeg:NaN}));
  assert.throws(()=>estimate({...input,points:input.points.slice(0,3)}));
  assert.throws(()=>estimate({...input,points:[{x:0,y:0},{x:0,y:0},...input.points.slice(2)]}));
  assert.throws(()=>estimate({...input,points:[{x:NaN,y:0},...input.points.slice(1)]}));
});
test('each supplied table row keeps its strict high bound and unspecified gap',()=>{
  for(const [sex,position,low,max,high] of [['male','right',4,5.9,6],['female','right',5,6.9,7],
    ['male','left',0,2.9,3],['female','left',0,5.9,6]]) {
    assert.equal(categoryFor(low-.01,sex,position),'ต่ำกว่า');
    assert.equal(categoryFor(low,sex,position),'มาตรฐาน');
    assert.equal(categoryFor(max,sex,position),'มาตรฐาน');
    assert.equal(categoryFor((max+high)/2,sex,position),'ช่วงรอยต่อที่ตารางไม่ได้ระบุ');
    assert.equal(categoryFor(high,sex,position),'ช่วงรอยต่อที่ตารางไม่ได้ระบุ');
    assert.equal(categoryFor(high+.01,sex,position),'สูงกว่า');
  }
});
