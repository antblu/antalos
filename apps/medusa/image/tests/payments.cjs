// Offline provider contract tests. All HTTP calls are intercepted; no processor credentials are used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const file = require('node:path').resolve(__dirname, '../src/modules/paypal/service.ts')
const compiled = new Module(file, module)
compiled.filename = file
compiled.paths = Module._nodeModulePaths(require('node:path').dirname(file))
compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file)
const PayPal = compiled.exports.default
const provider = new PayPal({}, {clientId:'fixture-client',clientSecret:'fixture-secret',webhookId:'fixture-hook',environment:'sandbox',storefrontUrl:'https://shop.example'})
const unit = () => ({custom_id:'payses_fixture', amount:{currency_code:'USD',value:'12.34'}, payments:{}})
let order, calls, verified = true, timeoutAfterAuthorization = false, failureStatus = 0
const response = (body, status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
const realFetch = global.fetch
global.fetch = async(url, options={})=>{
  assert.ok(url.startsWith('https://api-m.sandbox.paypal.com/'),'Sandbox must never contact a live payment endpoint')
  const path = new URL(url).pathname
  const body = options.body ? String(options.body) : undefined
  calls.push({path,body,headers:options.headers})
  if (path==='/v1/oauth2/token') return response({access_token:'fixture-token',expires_in:3600})
  if (path.endsWith('verify-webhook-signature')) return response({verification_status:verified?'SUCCESS':'FAILURE'})
  if (failureStatus) return response({},failureStatus)
  if (path==='/v2/checkout/orders' && options.method==='POST') return response(order)
  if (path==='/v2/checkout/orders/ORDER1') return response(order)
  if (path.endsWith('/authorize')) {
    order.status='COMPLETED';order.purchase_units[0].payments.authorizations=[{id:'AUTH1',status:'CREATED',amount:unit().amount}]
    if (timeoutAfterAuthorization) throw new Error('network timeout')
    return response(order)
  }
  if (path.endsWith('/capture')) {
    const capture={id:'CAPTURE1',status:'COMPLETED',amount:unit().amount}
    order.purchase_units[0].payments.captures=[capture];return response(capture)
  }
  if (path.endsWith('/refund')) return response({id:'REFUND1',status:'COMPLETED'})
  if (path.endsWith('/void')) { order.purchase_units[0].payments.authorizations[0].status='VOIDED'; return new Response(null,{status:204}) }
  throw new Error(`Unexpected HTTP call: ${path}`)
}
function reset(){order={id:'ORDER1',status:'CREATED',intent:'AUTHORIZE',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1'}],purchase_units:[unit()]};calls=[];verified=true;failureStatus=0;timeoutAfterAuthorization=false}
const input = ()=>({amount:'12.34',currency_code:'usd',data:{session_id:'payses_fixture',return_url:'https://shop.example/es/checkout?payment_return=1',cancel_url:'https://shop.example/es/checkout'},context:{idempotency_key:'fixture-create'}})
const webhook = (type)=>({data:{},rawData:JSON.stringify({event_type:type,resource:{id:type.startsWith('PAYMENT.CAPTURE.')?'CAPTURE1':'AUTH1',supplementary_data:{related_ids:{order_id:'ORDER1'}}}}),headers:Object.fromEntries(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].map(name=>[name,'fixture']))})
;(async()=>{
  reset()
  await assert.rejects(()=>provider.initiatePayment({...input(),currency_code:'cop'}),/currency/)
  await assert.rejects(()=>provider.initiatePayment({...input(),amount:'1.001'}),/amount/)
  await assert.rejects(()=>provider.initiatePayment({...input(),amount:'0'}),/amount/)
  await assert.rejects(()=>provider.initiatePayment({...input(),data:{...input().data,return_url:'https://evil.example'}}),/origin/)
  assert.equal(calls.length,0)
  const session=await provider.initiatePayment(input())
  assert.equal(session.data.amount,'12.34');assert.equal(session.status,'pending')
  const create=calls.find(call=>call.path==='/v2/checkout/orders')
  assert.equal(JSON.parse(create.body).purchase_units[0].amount.value,'12.34','PayPal receives Medusa v2 major units')
  assert.equal(JSON.parse(create.body).intent,'AUTHORIZE')
  assert.equal((await provider.authorizePayment({data:session.data})).status,'pending','An unapproved order cannot authorize')
  order.status='APPROVED';timeoutAfterAuthorization=true
  assert.equal((await provider.updatePayment({...input(),data:session.data})).data.id,'ORDER1','Unchanged totals remain valid after approval')
  await assert.rejects(()=>provider.updatePayment({...input(),amount:'15',data:session.data}),/Cancel this PayPal/)
  await assert.rejects(()=>provider.authorizePayment({data:session.data}),/timeout/)
  timeoutAfterAuthorization=false
  assert.equal((await provider.authorizePayment({data:session.data})).status,'authorized')
  assert.equal(calls.filter(call=>call.path.endsWith('/authorize')).length,1,'Retry retrieves a successful authorization after an ambiguous timeout')
  await provider.capturePayment({data:session.data})
  await provider.capturePayment({data:session.data})
  assert.equal(calls.filter(call=>call.path.endsWith('/capture')).length,1,'Retry cannot capture twice')
  await provider.refundPayment({data:session.data,amount:'2.34',context:{idempotency_key:'refund-1'}})
  await provider.refundPayment({data:session.data,amount:'2.34',context:{idempotency_key:'refund-1'}})
  const refunds=calls.filter(call=>call.path.endsWith('/refund'))
  assert.equal(JSON.parse(refunds[0].body).amount.value,'2.34','Partial refund must not refund the whole order')
  assert.equal(refunds[0].headers['PayPal-Request-Id'],refunds[1].headers['PayPal-Request-Id'])
  await assert.rejects(()=>provider.refundPayment({data:session.data,amount:'1'}),/idempotency/)
  await assert.rejects(()=>provider.cancelPayment({data:session.data}),/refunded/)
  verified=false
  await assert.rejects(()=>provider.getWebhookActionAndData(webhook('PAYMENT.CAPTURE.COMPLETED')),/signature/)
  verified=true
  await assert.rejects(()=>provider.getWebhookActionAndData({...webhook('PAYMENT.CAPTURE.COMPLETED'),headers:{}}),/signature/)
  assert.equal((await provider.getWebhookActionAndData(webhook('PAYMENT.CAPTURE.COMPLETED'))).action,'captured')
  assert.equal((await provider.getWebhookActionAndData(webhook('CHECKOUT.ORDER.APPROVED'))).action,'not_supported')
  order.purchase_units[0].amount.value='99.00'
  await assert.rejects(()=>provider.authorizePayment({data:session.data}),/does not match/)
  reset()
  order.status='APPROVED'
  const automatic = new PayPal({}, {clientId:'fixture-client',clientSecret:'fixture-secret',webhookId:'fixture-hook',environment:'sandbox',autoCapture:true,storefrontUrl:'https://shop.example'})
  assert.equal((await automatic.authorizePayment({data:session.data})).status,'captured','Automatic capture happens after approval and authorization')
  assert.equal((await automatic.authorizePayment({data:session.data})).status,'captured')
  assert.equal(calls.filter(call=>call.path.endsWith('/capture')).length,1,'Automatic-capture retry cannot capture twice')
  order.purchase_units[0].payments.captures[0].status='DECLINED'
  assert.equal((await provider.getWebhookActionAndData(webhook('PAYMENT.CAPTURE.DENIED'))).action,'failed')
  order.purchase_units[0].payments.captures=[]
  order.purchase_units[0].payments.authorizations[0].status='VOIDED'
  assert.equal((await provider.getWebhookActionAndData(webhook('PAYMENT.AUTHORIZATION.VOIDED'))).action,'canceled')
  const linked=webhook('PAYMENT.AUTHORIZATION.VOIDED')
  const event=JSON.parse(linked.rawData)
  delete event.resource.supplementary_data
  event.resource.links=[{rel:'up',href:'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER1'}]
  assert.equal((await provider.getWebhookActionAndData({...linked,rawData:JSON.stringify(event)})).action,'canceled')
  event.resource.links[0].href='https://evil.example/v2/checkout/orders/ORDER1'
  assert.equal((await provider.getWebhookActionAndData({...linked,rawData:JSON.stringify(event)})).action,'not_supported')
  assert.equal((await provider.getPaymentStatus({data:session.data})).status,'canceled')
  console.log('Passed: automatic capture, void/denial events and PayPal currency/precision/origin restrictions, approval gate, timeout recovery, capture/refund idempotency, partial refunds, signed webhook handling and order amount checks.')
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.fetch=realFetch})
