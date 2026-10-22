import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
let env;
before(async()=>{
 env=await initializeTestEnvironment({
  projectId:"demo-cognitus",
  firestore:{rules:fs.readFileSync("firestore.rules","utf8")}
 });
 await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),"users","alice"),{uid:"alice",status:"active",role:"user"});
   await setDoc(doc(ctx.firestore(),"users","bob"),{uid:"bob",status:"active",role:"user"});
   await setDoc(doc(ctx.firestore(),"referenceRequests","private"),{requesterUid:"alice",status:"completed"});
   await setDoc(doc(ctx.firestore(),"referenceShares","secret"),{ownerUid:"alice"});
   await setDoc(doc(ctx.firestore(),"referenceNotifications","alice","items","one"),{requestId:"private",type:"completed"});
 });
});
after(async()=>{if(env)await env.cleanup()});
test("requester cannot read or forge a reference",async()=>{
 const db=env.authenticatedContext("alice").firestore();
 await assertFails(getDoc(doc(db,"referenceRequests","private")));
 await assertFails(setDoc(doc(db,"referenceRequests","forged"),{requesterUid:"alice",status:"completed"}));
});
test("another user cannot read private reference or share metadata",async()=>{
 const db=env.authenticatedContext("bob").firestore();
 await assertFails(getDoc(doc(db,"referenceRequests","private")));
 await assertFails(getDoc(doc(db,"referenceShares","secret")));
});
test("in-app reference notifications are owner-readable but server-write-only",async()=>{
 const a=env.authenticatedContext("alice").firestore();
 const b=env.authenticatedContext("bob").firestore();
 await assertSucceeds(getDoc(doc(a,"referenceNotifications","alice","items","one")));
 await assertFails(getDoc(doc(b,"referenceNotifications","alice","items","one")));
 await assertFails(setDoc(doc(a,"referenceNotifications","alice","items","two"),{type:"forged"}));
});
