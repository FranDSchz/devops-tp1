import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const bases = [process.env.API_A ?? 'http://localhost:3000', process.env.API_B ?? 'http://localhost:3000'];
async function request(base, path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, instance: response.headers.get('x-instance-id'), body: await response.json() };
}

const evidence = { executedAt: new Date().toISOString(), bases, rounds: [] };
for (const mode of ['vulnerable', 'protected']) {
  // Fresh incident per scenario, no flush/reset of existing data.
  const created = await request(bases[0], '/api/incidents', {
    title: `Race demo ${mode}`, service: 'demo', severity: 'low',
  });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const responses = await Promise.all(bases.map((base, i) => request(
    base, `/api/demo/incidents/${id}/assign/${mode}`, { responsible: ['Ana', 'Bruno'][i] },
  )));
  const final = await request(bases[0], `/api/incidents/${id}`);
  assert.equal(final.status, 200);
  evidence.rounds.push({ mode, incidentId: id, responses, final: final.body });
  console.log(JSON.stringify(evidence.rounds.at(-1), null, 2));
  assert.deepEqual(responses.map(r => r.status).sort(), mode === 'vulnerable' ? [200, 200] : [200, 409]);
  assert.notEqual(responses[0].instance, responses[1].instance, 'Use two distinct API processes');
  const winner = responses.find(r => r.status === 200).body.responsible;
  if (mode === 'protected') assert.equal(final.body.assignedTo, winner);
  // Repeated assignment must fail; an unrelated edit must preserve the winner.
  const repeat = await request(bases[1], `/api/demo/incidents/${id}/assign/${mode}`, { responsible: 'Otra persona' });
  assert.equal(repeat.status, 409);
  const edited = await request(bases[1], `/api/incidents/${id}`, { title: 'Edited after assignment' }, 'PATCH');
  assert.equal(edited.status, 200);
  assert.equal(edited.body.assignedTo, final.body.assignedTo);
  const persisted = await request(bases[0], `/api/incidents/${id}`);
  assert.equal(persisted.body.assignedTo, final.body.assignedTo);
  const missing = await request(bases[0], '/api/demo/incidents/missing-demo-id/assign/' + mode, { responsible: 'Ana' });
  assert.equal(missing.status, 404);
  evidence.rounds.at(-1).checks = { repeatedAssignment: repeat.status, editPreservedOwner: true, missingIncident: missing.status };
}
if (process.env.EVIDENCE_PATH) {
  await mkdir(dirname(process.env.EVIDENCE_PATH), { recursive: true });
  await writeFile(process.env.EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}
console.table(evidence.rounds.map(round => ({
  version: round.mode,
  respuestas: round.responses.map(response => response.status).join(' + '),
  responsableFinal: round.final.assignedTo,
  exitosConfirmados: round.responses.filter(response => response.status === 200).length,
})));
console.log('PASS: vulnerable = dos exitos; protegida = un exito + un conflicto, entre dos procesos API.');
