import assert from 'node:assert/strict';
const base = process.env.VIEWER_URL ?? 'http://viewer';
async function request(api, path, body) {
  const response = await fetch(`${base}/${api}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  return {status:response.status,instance:response.headers.get('x-instance-id'),body:await response.json()};
}
const page = await fetch(base, {signal:AbortSignal.timeout(10000)});
assert.equal(page.status,200);
assert.match(await page.text(),/Dos peticiones\. Un mismo incidente\./);
for(const scenario of ['concurrent','sequential','protected']) {
  const concurrent=scenario!=='sequential';
  const mode=scenario==='protected'?'protected':'vulnerable';
  const created=await request('a','/api/incidents',{title:'Viewer integration test',service:'demo',severity:'low'});
  assert.equal(created.status,201);
  const id=created.body.id;
  const assign=(api,responsible)=>request(api,`/api/demo/incidents/${id}/assign/${mode}?trace=true`,{responsible});
  const responses=concurrent?await Promise.all([assign('a','Ana'),assign('b','Bruno')]):[await assign('a','Ana'),await assign('b','Bruno')];
  assert.notEqual(responses[0].instance,responses[1].instance);
  assert.deepEqual(responses.map(r=>r.status).sort(),scenario==='concurrent'?[200,200]:[200,409]);
  for(const response of responses){
    if(mode==='protected'){
      assert.equal(response.body.trace.length,1);
      assert.equal(response.body.trace[0].step,'atomic');
      assert.equal(response.body.trace[0].result,response.status===200?'assigned':'conflict');
      continue;
    }
    assert.equal(response.body.trace[0].step,'read');
    if(response.status===200){
      assert.equal(response.body.trace[0].assignedTo,null);
      assert.equal(response.body.trace[1].step,'written');
      assert.equal(response.body.trace[1].assignedTo,response.body.responsible);
      assert.ok(response.body.trace[1].at>=response.body.trace[0].at);
    }else assert.equal(response.body.trace[0].assignedTo,'Ana');
  }
  const final=await request('a',`/api/incidents/${id}`);
  assert.equal(final.status,200);
  assert.ok(['Ana','Bruno'].includes(final.body.assignedTo));
  if(!concurrent)assert.equal(final.body.assignedTo,'Ana');
  if(mode==='protected')assert.equal(final.body.assignedTo,responses.find(r=>r.status===200).body.responsible);
  console.log(JSON.stringify({scenario,responses,finalOwner:final.body.assignedTo},null,2));
}
console.log('PASS: viewer + nginx + two real APIs + Redis, observed traces and sequential control.');
