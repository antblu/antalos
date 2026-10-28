const assert = require('node:assert/strict')
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript')
require.extensions['.ts'] = (m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
process.env.CUSTOMER_STOREFRONT_URL='https://emiliany.com'
process.env.EMAIL_LOGO_URL='https://emiliany.com/brand/emiliany-logo.png'
process.env.SUPPORT_EMAIL='support@example.com'
process.env.TRANSACTIONAL_EMAIL_ENABLED='true'
process.env.ODOO_ORDER_SYNC_ENABLED='true'
const {render}=require('../src/lib/lifecycle/templates.ts')
const order={id:'order_test',display_id:123,email:'test@example.com',created_at:'2026-10-27T12:00:00Z',currency_code:'usd',status:'pending',payment_status:'captured',total:110,subtotal:100,discount_total:5,tax_total:5,shipping_total:10,customer:{first_name:'Ana <script>'},items:[{id:'item_1',product_title:'Gold & silver',quantity:1,unit_price:100}],shipping_address:{first_name:'Ana',address_1:'A street',city:'Test'}}
for(const kind of ['purchase','shipping','delivery','cancellation','refund','processing','shipping_update','out_for_delivery','contact']){
 const output=render(kind,{order,ticket:'123',tracking:[{number:'SAFE123',url:'javascript:alert(1)'}],refund:{amount:10,provider:'Stripe',partial:true}})
 assert.ok(output.html.includes('alt="Emiliany"'));assert.ok(output.text.includes('Ana <script>'));assert.ok(output.html.includes('Ana &lt;script&gt;'));assert.ok(!output.html.includes('javascript:'));assert.ok(!output.html.includes('order_test'));assert.ok(output.text.includes('support@example.com'))
}
const shipping=render('shipping',{order,tracking:[{number:'TRACK1',url:'https://carrier.example/track/1',carrier:'Carrier'}]})
assert.ok(shipping.html.includes('https://carrier.example/track/1'));assert.ok(shipping.text.includes('TRACK1'))
let emails=0, odooExports=0, fail='none', tasks=[], lastPayload
const oldLoad=Module._load
class DeliveryError extends Error{constructor(retryable){super();this.retryable=retryable}}
Module._load=function(r,...args){
 if(r==='./mail')return {DeliveryError,sendMail:async()=>{emails++;if(fail==='retry')throw new DeliveryError(true);if(fail==='unknown')throw new DeliveryError(false);return 'message-id'}}
 if(r==='./odoo')return {exportOrder:async()=>{odooExports++;if(fail==='odoo')throw Error('offline');return 55}}
 return oldLoad.call(this,r,...args)
}
const {enqueue,drain}=require('../src/lib/lifecycle/queue.ts')
const {handle}=require('../src/lib/lifecycle/events.ts')
const locks=new Map()
const service={listLifecycleEvents:async f=>tasks.filter(t=>(!f.key||t.key===f.key)&&(!f.status||f.status.includes(t.status))),createLifecycleEvents:async t=>{if(tasks.some(x=>x.key===t.key))throw Error('unique');tasks.push({...t,id:String(tasks.length),status:'pending',attempts:0})},retrieveLifecycleEvent:async id=>tasks.find(t=>t.id===id),updateLifecycleEvents:async t=>Object.assign(tasks.find(x=>x.id===t.id),t)}
const fulfillment={id:'ful_1',shipped_at:'2026-10-27',delivered_at:'2026-10-28',order:{id:order.id},items:[{line_item_id:'item_1',quantity:1}],labels:[{tracking_number:'TRACK1',tracking_url:'https://carrier.example/1'}]}
let payment={provider_id:'pp_stripe_stripe',data:{confirmed_refunds:{r1:{id:'re_1',amount:10},r2:{id:'re_2',amount:20}}},payment_collection:{order:{id:order.id}}}
const c={resolve:n=>({lifecycle:service,logger:{info(){},warn(){}},locking:{execute:async(key,fn)=>{const prev=locks.get(key)||Promise.resolve();const next=prev.then(fn);locks.set(key,next.catch(()=>{}));return next}},query:{graph:async({entity})=>({data:[entity==='order'?order:entity==='payment'?payment:fulfillment]})}}[n])}
const due=()=>tasks.forEach(t=>t.available_at=new Date(0))
;(async()=>{
 await Promise.all(Array.from({length:10},()=>enqueue(c,'email','purchase',order.id,{order})))
 assert.equal(tasks.length,1);await drain(c);await drain(c);assert.equal(emails,1);assert.equal(tasks[0].status,'sent')
 tasks=[];emails=0;fail='retry';await enqueue(c,'email','purchase',order.id,{order});await drain(c);assert.equal(tasks[0].status,'retrying');fail='none';due();await drain(c);assert.equal(tasks[0].status,'sent');assert.equal(emails,2)
 tasks=[];fail='unknown';await enqueue(c,'email','purchase',order.id,{order});await drain(c);assert.equal(tasks[0].status,'review');const sent=emails;due();await drain(c);assert.equal(emails,sent)
 tasks=[];fail='none';await enqueue(c,'email','purchase',order.id,{order});tasks[0].status='sending';due();await drain(c);assert.equal(tasks[0].status,'review');assert.equal(emails,sent)
 tasks=[];order.payment_status='authorized';await handle(c,'order.placed',{id:order.id});assert.equal(tasks.length,0)
 order.payment_status='captured';await handle(c,'order.placed',{id:order.id});await handle(c,'payment.captured',{id:'pay_1'});assert.equal(tasks.length,2,'one email and one ERP task')
 await handle(c,'shipment.created',{id:'ful_1'});await handle(c,'shipment.created',{id:'ful_1'});assert.equal(tasks.filter(t=>t.kind==='shipping').length,2)
 assert.equal(tasks.find(t=>t.kind==='shipping').payload.items[0].quantity,1)
 await handle(c,'delivery.created',{id:'ful_1',no_notification:true});assert.equal(tasks.filter(t=>t.kind==='delivery'&&t.channel==='email').length,0)
 await handle(c,'payment.refunded',{id:'pay_1'});await handle(c,'payment.refunded',{id:'pay_1'});assert.equal(tasks.filter(t=>t.kind==='refund'&&t.channel==='email').length,2,'separate partial refunds get separate messages')
 payment.data={};await assert.rejects(()=>handle(c,'payment.refunded',{id:'pay_1'}),/receipt/)
 console.log('Passed lifecycle: template escaping and personalization, safe tracking links, concurrent enqueue deduplication, retry, ambiguous SMTP quarantine, capture gate, partial shipment mapping, notification suppression and refund receipt deduplication.')
})().catch(e=>{console.error(e);process.exitCode=1})
const {verifyFulfillmentSignature}=require('../src/lib/lifecycle/signature.ts')
const {createHmac}=require('node:crypto')
const signingKey='x'.repeat(32),now=Date.now(),timestamp=String(Math.floor(now/1000)),raw=Buffer.from('{"status":"shipped"}')
const sig=createHmac('sha256',signingKey).update(timestamp+'.').update(raw).digest('hex')
assert.equal(verifyFulfillmentSignature(raw,timestamp,sig,signingKey,now),true)
assert.equal(verifyFulfillmentSignature(Buffer.from('{}'),timestamp,sig,signingKey,now),false)
assert.equal(verifyFulfillmentSignature(raw,timestamp,sig,signingKey,now+301000),false)
assert.equal(verifyFulfillmentSignature(raw,timestamp,sig,undefined,now),false)
