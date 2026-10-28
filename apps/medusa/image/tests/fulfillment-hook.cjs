const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),{createHmac}=require('node:crypto')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
let shipped=0,delivered=0,notifications=0
const f={id:'ful_test',order:{id:'order_test'},items:[{line_item_id:'item_1',quantity:1}],metadata:{existing:true}}
const original=Module._load
Module._load=function(r,...args){if(r==='@medusajs/medusa/core-flows')return {createOrderShipmentWorkflow:()=>({run:async({input})=>{shipped++;assert.equal(input.items[0].id,'item_1');f.shipped_at=new Date()}}),markOrderFulfillmentAsDeliveredWorkflow:()=>({run:async()=>{delivered++;f.delivered_at=new Date()}})};if(r.endsWith('lib/lifecycle/events'))return {handle:async()=>{notifications++}};return original.call(this,r,...args)}
const {POST}=require('../src/api/hooks/commerce/fulfillment/route.ts')
process.env.FULFILLMENT_WEBHOOK_SECRET='test-'.repeat(8)
const scope={resolve:n=>({locking:{execute:async(_k,fn)=>fn()},query:{graph:async()=>({data:[f]})},fulfillment:{updateFulfillment:async(_id,v)=>Object.assign(f,v)}}[n])}
async function request(body,corrupt=false){const rawBody=Buffer.from(JSON.stringify(body)),timestamp=String(Math.floor(Date.now()/1000));const signature=createHmac('sha256',process.env.FULFILLMENT_WEBHOOK_SECRET).update(timestamp+'.').update(rawBody).digest('hex');const req={scope,body,rawBody,headers:{'x-commerce-timestamp':timestamp,'x-commerce-signature':corrupt?'0'.repeat(64):signature}};const res={code:200,status(code){this.code=code;return this},json(data){this.data=data}};await POST(req,res);return res}
const data={order_id:'order_test',fulfillment_id:'ful_test',status:'shipped',carrier:'Test Carrier',labels:[{tracking_number:'TRACK1',tracking_url:'https://carrier.example/TRACK1'}]}
;(async()=>{
 assert.equal((await request(data,true)).code,401);assert.equal(shipped,0)
 assert.equal((await request({...data,order_id:'order_other'})).code,409);assert.equal(shipped,0)
 assert.equal((await request({...data,status:'delivered'})).code,409)
 assert.equal((await request({...data,labels:[{tracking_number:'1',tracking_url:'javascript:bad'}]})).code,422)
 assert.equal((await request(data)).code,200);assert.equal(shipped,1);assert.equal(f.metadata.carrier,'Test Carrier');assert.equal(f.metadata.existing,true)
 await request(data);assert.equal(shipped,1,'Replay does not re-run shipment workflow')
 await request({...data,status:'delivered'});await request({...data,status:'delivered'});assert.equal(delivered,1)
 assert.equal(notifications,4,'Replay can recover missing notification enqueue; outbox tests verify unique keys')
 console.log('Fulfillment callback: signature, order linkage, safe tracking, delivery ordering, carrier preservation and workflow replay passed.')
})().catch(e=>{console.error(e);process.exitCode=1})
