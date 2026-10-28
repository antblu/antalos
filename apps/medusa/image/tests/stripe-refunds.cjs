const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const Provider=require('../src/modules/stripe/service.ts').default
const provider=new Provider({}, {apiKey:'sk_test_fixture',webhookSecret:'whsec_fixture'})
let status='pending',creates=0,retrieves=0,keys=[]
provider.stripe_.refunds={create:async(body,options)=>{creates++;keys.push(options.idempotencyKey);assert.equal(body.amount,234);return {id:'re_1',status:'pending'}},retrieve:async()=>{retrieves++;return {id:'re_1',status,amount:234}}}
const input={amount:'2.34',data:{id:'pi_test',currency:'usd'},context:{idempotency_key:'refund_operation_1'}}
;(async()=>{
 await assert.rejects(()=>provider.refundPayment({...input,context:{}}),/stable/);assert.equal(creates,0)
 await assert.rejects(()=>provider.refundPayment(input),/not confirmed/)
 status='succeeded';const result=await provider.refundPayment(input);assert.deepEqual(keys,['refund_operation_1','refund_operation_1']);assert.equal(result.data.confirmed_refunds.refund_operation_1.amount,2.34);assert.equal(retrieves,2)
 await provider.refundPayment({...input,data:result.data});assert.equal(creates,2)
 await assert.rejects(()=>provider.refundPayment({...input,data:result.data,amount:3}),/mismatch/)
 const event=JSON.stringify({id:'evt_test',object:'event',type:'payment_intent.succeeded',data:{object:{id:'pi_test',amount:1234,currency:'usd',metadata:{session_id:'payses_test'}}}})
 const signature=provider.stripe_.webhooks.generateTestHeaderString({payload:event,secret:'whsec_fixture'})
 const action=await provider.getWebhookActionAndData({data:JSON.parse(event),rawData:event,headers:{'stripe-signature':signature}})
 assert.equal(action.action,'captured');assert.equal(action.data.session_id,'payses_test')
 const invalid=await provider.getWebhookActionAndData({data:JSON.parse(event),rawData:event+' ',headers:{'stripe-signature':signature}}).catch(()=>({action:'rejected'}))
 assert.notEqual(invalid.action,'captured')
 console.log('Stripe: signed capture webhook, tamper rejection, partial refund conversion, pending-status gate, same-key reconciliation and recorded-receipt replay passed.')
})().catch(e=>{console.error(e);process.exitCode=1})
