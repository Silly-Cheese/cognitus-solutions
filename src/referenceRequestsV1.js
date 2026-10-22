
import { FIREBASE_CDN_BASE, getFirebaseState } from "./firebase/firebaseApp.js";
let functionsApi;
async function backend() {
  if (!functionsApi) {
    const { getFunctions, httpsCallable } = await import(`${FIREBASE_CDN_BASE}/firebase-functions.js`);
    const firebase = getFirebaseState();
    if (!firebase.app) throw new Error("Cognitus Firebase is not available.");
    const functions = getFunctions(firebase.app, "us-central1");
    functionsApi = (name, data = {}) => httpsCallable(functions, name)(data).then(x => x.data);
  }
  return functionsApi;
}
function esc(v) {return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");}
function fmt(ms) {return ms ? new Date(ms).toLocaleDateString() : "—";}
function status(s) {return ["pending","completed","declined","withdrawn","expired"].includes(s) ? s : "unknown";}
function message(root, text, error=false) {
  const node = root.querySelector("#reference-feedback");
  if (node) { node.hidden = false; node.dataset.error=String(error);node.textContent = text; }
}
function selectedOrgOptions(orgs) { return orgs.map(o=>`<option value="${esc(o.id)}">${esc(o.name||o.id)}</option>`).join("");}
function requestRow(r) {
 const s=status(r.status);
 return `<article class="reference-item"><header><h3>${esc(r.organizationName)}</h3><span class="reference-badge" data-status="${s}">${esc(s)}</span></header>
 <p><strong>${esc(r.requestedPosition)}</strong> · Requested ${fmt(r.createdAt)}</p>
 <p>Expires ${fmt(r.expiresAt)}</p>
 ${r.response ? `<p><strong>Employment confirmed:</strong> ${r.response.verifiedEmployment ? "Yes" : "No"}<br>
 <strong>Position:</strong> ${esc(r.response.position)}${r.response.comments ? `<br><strong>Comments:</strong> ${esc(r.response.comments)}` : ""}</p>` : ""}
 <div class="reference-actions">
 ${s==="pending" ? `<button class="button button-light" type="button" data-withdraw="${esc(r.id)}">Withdraw</button>` : ""}
 ${s==="completed" ? `<button class="button button-dark" type="button" data-share="${esc(r.id)}">Create private share</button>` : ""}
 </div></article>`;
}
async function call(name, data) {const f=await backend();return f(name,data);}
function renderShare(root, ref) {
  const info=ref.reference;
  root.innerHTML = `<section class="reference-page"><section class="reference-panel"><p class="eyebrow">Cognitus References · Private share</p>
    <h1>Employment reference</h1><h2>${esc(info.requesterDisplayName)}</h2>
    <p><strong>Organization:</strong> ${esc(info.organizationName)}</p>
    <p><strong>Position requested:</strong> ${esc(info.requestedPosition)}</p>
    <p><strong>Confirmed position:</strong> ${esc(info.confirmedPosition)}</p>
    <p><strong>Employment verified:</strong> ${info.verifiedEmployment?"Yes":"Not confirmed"}</p>
    ${info.comments ? `<p><strong>Employer comments:</strong> ${esc(info.comments)}</p>` : ""}
    <p>Responded ${fmt(info.respondedAt)} · Link expires ${fmt(info.expiresAt)}</p>
    <p class="reference-feedback">This reference was supplied by an authorized member of the named Cognitus organization. It is not a comprehensive background check.</p>
    <a class="button button-light" href="#/">Return home</a></section></section>`;
}
export async function renderReferenceRequestsPage(root,{user,account}) {
 if (!document.querySelector('link[data-reference-css]')) {const l=document.createElement("link");l.rel="stylesheet";l.href="./src/referenceRequestsV1.css?v=1";l.dataset.referenceCss="1";document.head.append(l);}
 const search=new URLSearchParams(location.hash.split("?")[1] || "");
 if (location.hash.startsWith("#/references/share")) {
   root.innerHTML='<section class="panel"><p>Verifying shared reference…</p></section>';
   try {renderShare(root,await call("viewSharedReference",{shareId:search.get("shareId"),token:search.get("token")}));}
   catch {root.innerHTML='<section class="panel"><h1>Reference unavailable</h1><p>This link may have expired, been revoked, or been entered incorrectly.</p></section>';}
   return;
 }
 if (!user || account?.status!=="active") {
   root.innerHTML='<section class="panel"><h1>Sign in to view references</h1><p>Reference requests require an active Cognitus account.</p><a class="button button-dark" href="#/login">Sign in</a></section>';return;
 }
 const firestore=await import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);
 const firebase=getFirebaseState();
 const orgSnapshot=await firestore.getDocs(firestore.query(firestore.collection(firebase.db,"organizations"),firestore.limit(150)));
 const orgs=orgSnapshot.docs.map(d=>({id:d.id,...d.data()})).filter(o=>o.verificationStatus==="verified").sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 root.innerHTML=`<div class="reference-page">
 <section class="reference-hero hero"><div><p class="eyebrow">Employment · References</p><h1>My References</h1><p>Request employment confirmation directly from verified employers. Responses remain private until you choose to share them.</p></div><span class="reference-badge">Private by default</span></section>
 <div class="reference-tabs" role="tablist" aria-label="Reference workspaces"><button type="button" role="tab" aria-selected="true" data-reference-tab="mine">My requests</button><button type="button" role="tab" aria-selected="false" data-reference-tab="employer">Employer inbox</button></div>
 <div id="reference-feedback" class="reference-feedback" role="status" hidden></div>
 <section id="reference-mine" class="reference-grid">
 <div class="reference-panel"><h2>Request a reference</h2><form class="reference-form" id="reference-request-form">
 <label>Previous organization<select required name="organizationId"><option value="">Select verified employer</option>${selectedOrgOptions(orgs)}</select></label>
 <label>Your former position<input required maxlength="120" name="requestedPosition" placeholder="e.g., Senior Moderator"></label>
 <div class="form-row"><label>Start date (optional)<input name="startedOn" type="date"></label><label>End date (optional)<input name="endedOn" type="date"></label></div>
 <label class="reference-check"><input name="consent" type="checkbox" required><span>I authorize Cognitus to contact this organization for a reference about my employment.</span></label>
 <button class="button button-dark" type="submit">Send reference request</button>
 <p class="disclaimer">Only verified organizations currently using Cognitus can respond in this release. Reference responses are not public.</p>
 </form></div><div class="reference-panel"><h2>Request history</h2><div id="reference-my-list" class="reference-list" aria-live="polite">Loading…</div><div id="reference-share-result"></div></div></section>
 <section id="reference-employer" class="reference-panel" hidden><h2>Employer reference inbox</h2>
 <div class="reference-form"><label>Organization<select id="reference-employer-org"><option value="">Choose organization</option>${selectedOrgOptions(orgs)}</select></label>
 <button id="reference-load-inbox" class="button button-light" type="button">Load requests</button></div><div id="reference-inbox-list" class="reference-list" style="margin-top:1rem" aria-live="polite"></div></section></div>`;
 const mine=root.querySelector("#reference-my-list");
 async function reloadMine(){
   mine.textContent="Loading your requests…";
   try {const result=await call("listReferenceRequests",{mode:"mine"});
      mine.innerHTML=result.items.length?result.items.map(requestRow).join(""):'<div class="reference-empty">No reference requests yet. Choose a former employer to get started.</div>';
   } catch(e){mine.textContent=e.message||"Unable to load your requests.";}
 }
 root.querySelectorAll("[data-reference-tab]").forEach(button=>button.addEventListener("click",()=>{
    const isMine=button.dataset.referenceTab==="mine";
    root.querySelector("#reference-mine").hidden=!isMine;
    root.querySelector("#reference-employer").hidden=isMine;
    root.querySelectorAll("[data-reference-tab]").forEach(b=>b.setAttribute("aria-selected",String(b===button)));
 }));
 root.querySelector("#reference-request-form").addEventListener("submit",async event=>{
   event.preventDefault();const form=event.currentTarget;const button=form.querySelector('[type="submit"]');button.disabled=true;
   try {const values=Object.fromEntries(new FormData(form).entries());values.consent=true;await call("createReferenceRequest",values);message(root,"Reference request submitted.");form.reset();await reloadMine();}
   catch(e){message(root,e.message||"Unable to create request.",true);} finally{button.disabled=false;}
 });
 mine.addEventListener("click",async event=>{
   const withdraw=event.target.closest("[data-withdraw]");
   const share=event.target.closest("[data-share]");
   if(withdraw){
      if(!confirm("Withdraw this reference request?")) return;
      withdraw.disabled=true;
      try{await call("withdrawReferenceRequest",{requestId:withdraw.dataset.withdraw});message(root,"Request withdrawn.");await reloadMine();}
      catch(e){message(root,e.message||"Withdrawal failed.",true);withdraw.disabled=false;}
   }
   if(share){
      share.disabled=true;
      try{
        const result=await call("createReferenceShare",{requestId:share.dataset.share});
        const url=location.origin+location.pathname+`#/references/share?shareId=${encodeURIComponent(result.shareId)}&token=${encodeURIComponent(result.token)}`;
        const wrap=root.querySelector("#reference-share-result");
        wrap.innerHTML='<p><strong>Private link (expires in 7 days)</strong></p><input class="reference-copy" aria-label="Private reference link" readonly><button type="button" class="button button-light" id="reference-copy">Copy link</button>';
        wrap.querySelector("input").value=url;
        wrap.querySelector("#reference-copy").onclick=async()=>{try{await navigator.clipboard.writeText(url);message(root,"Link copied.");}catch{wrap.querySelector("input").select();message(root,"Select and copy the link.");}};
      }catch(e){message(root,e.message||"Could not create share.",true);}finally{share.disabled=false;}
   }
 });
 const inbox=root.querySelector("#reference-inbox-list");
 root.querySelector("#reference-load-inbox").addEventListener("click",async()=>{
   const organizationId=root.querySelector("#reference-employer-org").value;
   if(!organizationId){message(root,"Choose your organization.",true);return;}
   inbox.textContent="Loading employer requests…";
   try{
     const {items}=await call("listReferenceRequests",{mode:"employer",organizationId});
     inbox.innerHTML=items.length?items.map(r=>`<article class="reference-item"><header><h3>${esc(r.requesterDisplayName)}</h3><span class="reference-badge" data-status="${status(r.status)}">${status(r.status)}</span></header>
       <p>Requested position: ${esc(r.requestedPosition)} · ${fmt(r.createdAt)}</p>
       ${status(r.status)==="pending"?`<form class="reference-form" data-respond="${esc(r.id)}"><label>Confirmed position<input name="position" maxlength="120" placeholder="Position on record" required></label>
       <label>Can you confirm this employment?<select name="verifiedEmployment"><option value="true">Yes</option><option value="false">No</option></select></label>
       <label>Professional reference (optional)<textarea name="comments" maxlength="1000" rows="3"></textarea></label>
       <div class="reference-actions"><button class="button button-dark" name="decision" value="complete">Submit response</button><button class="button button-light" name="decision" value="decline">Decline</button></div></form>`:""}
     </article>`).join(""):'<div class="reference-empty">No requests for this organization.</div>';
   }catch(e){inbox.textContent="Unable to open this organization’s inbox: "+(e.message||"Access denied");}
 });
 inbox.addEventListener("submit",async event=>{
   const form=event.target.closest("[data-respond]");if(!form)return;
   event.preventDefault();const submitter=event.submitter;
   const decision=submitter?.value==="decline"?"decline":"complete";
   const data=Object.fromEntries(new FormData(form).entries());
   const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
   try{await call("respondToReferenceRequest",{requestId:form.dataset.respond,decision,position:data.position||"",comments:data.comments||"",verifiedEmployment:data.verifiedEmployment==="true"});
     message(root,decision==="complete"?"Reference response saved.":"Request declined.");
     root.querySelector("#reference-load-inbox").click();
   }catch(e){message(root,e.message||"Unable to submit response.",true);if(button)button.disabled=false;}
 });
 await reloadMine();
}
