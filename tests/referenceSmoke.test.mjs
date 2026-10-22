import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(f,"utf8");

test("Cognitus route and navigation link to References",()=>{
  assert.match(read("src/app.js"),/current === "\/references"/);
  assert.match(read("src/navigationEnhancements.js"),/href: "#\/references"/);
  assert.match(read("src/app.js"),/href="#\/references"/);
});
test("sensitive reference collections reject direct reads and writes",()=>{
  const rules=read("firestore.rules");
  for(const collection of ["referenceRequests","referenceRequestLocks","referenceRequestRateLimits","referenceShares","referenceAuditEvents"]){
    assert.match(rules,new RegExp("match /"+collection+"/"));
  }
  assert.match(rules,/match \/referenceRequests\/\{referenceId\} \{\s*allow read, write: if false;/);
});
test("reference requests use authenticated callables and backend authorization",()=>{
  const s=read("functions/index.js");
  for(const fn of ["createReferenceRequest","listReferenceRequests","respondToReferenceRequest","withdrawReferenceRequest","createReferenceShare","revokeReferenceShare","viewSharedReference"]){
    assert.match(s,new RegExp("exports\\."+fn+" = onCall"));
  }
  assert.match(s,/member\.permissions\?\.addEmploymentRecords/);
  assert.match(s,/timingSafeEqual/);
});
test("hosting remains static and codebase is isolated",()=>{
 const json=JSON.parse(read("firebase.json"));
 assert.equal(json.functions[0].codebase,"references");
 assert.ok(!("hosting" in json));
});
