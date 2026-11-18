// Independent UI review. Chrome/CDP, mocked RPC and wallet; never broadcasts.
import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { PublicKey } from '@solana/web3.js';
import { setTimeout as delay } from 'node:timers/promises';
const out = new URL('../scratch/sol_ui_repair_evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const results = { date: new Date().toISOString(), observations: {}, errors: [], rpc: [], uploads: [], checks: [], requests: [] };
results.sources = {};
for(const p of ['src/lib/tokenTransaction.js','vite.config.js','src/components/CoinerLogo.jsx','src/App.jsx','src/main.jsx','src/index.css','src/components/CreatorPage.jsx','src/components/TokenForm.jsx','src/components/LivePreview.jsx','src/components/LaunchModal.jsx','src/components/StepGuide.jsx','src/components/FAQ.jsx','src/components/ui/3d-card.jsx','src/components/ui/border-beam.jsx','src/components/ui/GoldCoin3D.jsx','src/components/ui/GridBackground.jsx','src/components/ui/accordion.jsx','src/lib/admin.jsx','src/lib/solana.js','src/components/DeferredWalletModalProvider.jsx','src/components/WalletPicker.jsx','package.json','pnpm-lock.yaml']) results.sources[p]=createHash('sha256').update(await readFile(p)).digest('hex');
results.bundle = [];
for(const name of await readdir('scratch/sol_ui_repair_build/assets')) { const b=await readFile('scratch/sol_ui_repair_build/assets/'+name);results.bundle.push({name,bytes:b.length,gzip:gzipSync(b).length}); }
results.totalJsGzip=results.bundle.filter(x=>x.name.endsWith('.js')).reduce((n,x)=>n+x.gzip,0);
const server = await preview({ build: { outDir: 'scratch/sol_ui_repair_build' }, preview: { host: '127.0.0.1', port: 4207, strictPort: true }, logLevel: 'error' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9407', `--user-data-dir=${process.env.TEMP + '/coiner-sol-ui-profile-' + Date.now()}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const deadline = setTimeout(() => chrome.kill(), 240000);
let ws;
let seq = 0;
const pending = new Map();
async function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expression) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + r.exceptionDetails.exception?.description);
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 600; i++) { if (await ev(`Boolean(${expression})`)) return; await delay(100); }
  throw new Error(`UI timeout ${expression}`);
}
async function click(text) { await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(text)})); if(!b)throw Error('button missing'); b.click()})()`); await delay(180); }
async function field(name, value) { await ev(`(()=>{const e=document.querySelector('[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`); await delay(80); }
async function snap(name, full = false) {
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: await ev('innerWidth'), height: await ev('document.documentElement.scrollHeight'), scale: 1 } } : {}) });
  await writeFile(new URL(`${name}.png`, out), Buffer.from(r.data, 'base64'));
}
async function observe(name, expression) { const v = await ev(expression); results.observations[name] = v; return v; }
async function check(name, expression) { const ok = Boolean(await ev(expression)); results.checks.push({ name, ok }); }
const publicBytes = [...new PublicKey('So11111111111111111111111111111111111111112').toBytes()];
const adminBytes = [...new PublicKey('2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV').toBytes()];
try {
  let target;
  for (let i = 0; i < 100; i++) { try { target = (await (await fetch('http://127.0.0.1:9407/json')).json()).find(x => x.type === 'page'); if (target) break; } catch {} await delay(100); }
  if (!target) throw Error('Chrome failed to start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', async e => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } return; }
    if (m.method === 'Runtime.consoleAPICalled' && ['error','warn'].includes(m.params.type)) results.errors.push(m.params.args.map(a=>a.value||a.description).join(' ').slice(0,500)); if (m.method === 'Network.loadingFailed') results.errors.push(m.params.errorText); if (m.method === 'Runtime.exceptionThrown') results.errors.push(m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params; if (request.url.startsWith('http://127.0.0.1:4207/')) results.requests.push(new URL(request.url).pathname);
    try {
      if (request.url.startsWith('http://127.0.0.1:4207/') && !request.url.includes('/api/')) return void await cdp('Fetch.continueRequest', { requestId });
      let response;
      let status = 200;
      if(request.method==='OPTIONS') { response={}; } else if (request.url.includes('/api/upload-metadata')) {
        results.uploads.push({ scenario: results.observations.uploadMode || 'success', hasDecimalsZero: request.postData?.includes('0') });
        const fail = results.observations.uploadMode === 'failure';
        status = fail ? 503 : 200;
        response = fail ? { error: 'AUDIT: upload unavailable' } : { success: true, metadataUri: 'https://example.invalid/audit.json' };
      } else if (request.postData?.startsWith('{')) {
        const q = JSON.parse(request.postData); results.rpc.push(q.method);
        let value;
        if (q.method === 'getMinimumBalanceForRentExemption') value = 2000000;
        else if (q.method === 'getLatestBlockhash') value = { context: { slot: 1 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 999999999 } };
        else if (q.method === 'getSignatureStatuses') {
          const mode = results.observations.recoveryMode || 'confirmed';
          if (results.observations.rpcDelayMs) await delay(results.observations.rpcDelayMs);
          value = { context: { slot: 1 }, value: mode === 'not_found' ? [null] : mode === 'pending' ? [{err:null,confirmations:0,confirmationStatus:'processed',slot:1}] : [{ err: mode === 'failed' ? {Custom: 1} : null, confirmations: 1, confirmationStatus: 'confirmed', slot: 1 }] };
        }
        else if (q.method === 'getBalance') value = { context: { slot: 1 }, value: 10000000000 };
        else { await cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); return; }
        response = q.method==='getSignatureStatuses' && results.observations.recoveryMode==='rpc_unavailable' ? {jsonrpc:'2.0',id:q.id,error:{code:-32000,message:'AUDIT: RPC unavailable'}} : { jsonrpc: '2.0', id: q.id, result: value };
      } else { await cdp('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); return; }
      await cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, {name:'Access-Control-Allow-Headers',value:'*'}, {name:'Access-Control-Allow-Methods',value:'POST, OPTIONS'}], body: Buffer.from(JSON.stringify(response)).toString('base64') });
    } catch (e) { results.errors.push(e.message); }
  });
  await cdp('Network.enable'); await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Performance.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `window.__auditSigns=0; window.__auditWalletBytes=${JSON.stringify(publicBytes)}; window.__auditListeners={}; window.phantom={solana:{isPhantom:true,isConnected:false,publicKey:{toBytes:()=>new Uint8Array(window.__auditWalletBytes)},connect:async function(){this.isConnected=true},disconnect:async function(){this.isConnected=false},on:(n,f)=>window.__auditListeners[n]=f,off:()=>{},signAndSendTransaction:async()=>{window.__auditSigns++;throw Error('AUDIT: wallet declined')},signTransaction:async()=>{throw Error('AUDIT: wallet declined')}}}; window.__auditFiber=(name)=>{const root=document.querySelector('#root');let f=root[Object.keys(root).find(k=>k.startsWith('__reactContainer'))]?.stateNode?.current;const visit=x=>{if(!x)return null;if(x.type?.name===name||(name==='CreatorPage'&&x.memoizedState?.memoizedState?.name!==undefined&&x.memoizedState?.memoizedState?.symbol!==undefined))return x;return visit(x.child)||visit(x.sibling)};return visit(f)};window.__auditState=(name,index,value)=>{let h=window.__auditFiber(name).memoizedState;while(index--)h=h.next;h.queue.dispatch(value)};` });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:4207/' });
  await wait("document.querySelector('[name=name]')"); await delay(1000);
  results.initialRequests=[...results.requests];
  await observe('beamStart', `getComputedStyle(document.querySelector('[style*="--size"]'),'::after').offsetDistance`);await delay(250);await observe('beamMoved', `getComputedStyle(document.querySelector('[style*="--size"]'),'::after').offsetDistance`);
  await snap('desktop-full', true);
  await observe('initial', `({title:document.title,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,animations:document.getAnimations().map(a=>({name:a.animationName,iterations:a.effect.getTiming().iterations})),ids:[...document.querySelectorAll('[id]')].map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i),beam:(()=>{let e=document.querySelector('[style*="--size"]');let s=getComputedStyle(e,'::after');return {animation:s.animationName,duration:s.animationDuration,offset:s.offsetPath}})(),wallet:(()=>{let s=getComputedStyle(document.querySelector('.wallet-adapter-button'));return {color:s.color,background:s.backgroundColor,image:s.backgroundImage}})(),paint:performance.getEntriesByType('paint').map(x=>({name:x.name,startTime:x.startTime}))})`);
  await delay(5100);
  await observe('settledDecoration', 'document.getAnimations().map(a=>({name:a.animationName,state:a.playState,time:a.currentTime,timing:a.effect.getComputedTiming()}))');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await observe('reducedMotion', `({matches:matchMedia('(prefers-reduced-motion:reduce)').matches,animations:document.getAnimations().map(a=>a.animationName)})`);
  await cdp('Emulation.setEmulatedMedia', { features: [] });
  await observe('lockedSteps', `[...document.querySelectorAll('[aria-label^="Step "]')].slice(1).every(e=>e.getAttribute('aria-disabled')==='true'&&e.title==='Complete Token Basics first')`);
  await click('Next'); await check('empty basics refused', "!!document.querySelector('[role=alert]') && !!document.querySelector('[name=name]')");
  await field('name', 'Audit Coin'); await field('symbol', 'audit'); await field('decimals', '0');
  await click('Next'); await check('step media reached', "!!document.querySelector('#image-upload')");
  await ev(`(()=>{const f=new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4FEAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'audit.png',{type:'image/png'});const d=new DataTransfer();d.items.add(f);const e=document.querySelector('#image-upload');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await delay(150); await snap('desktop-media');
  await click('Next'); await observe('securityDefaults', "[...document.querySelectorAll('[role=switch]')].map(e=>({id:e.id,checked:e.getAttribute('aria-checked'),labels:[...(e.labels||[])].map(x=>x.textContent),track:getComputedStyle(e).backgroundColor,thumb:getComputedStyle(e.firstElementChild).backgroundColor,ring:getComputedStyle(e).getPropertyValue('--color-ring'),rect:e.getBoundingClientRect().toJSON()}))");
  await snap('desktop-security');
  await ev("document.querySelector('[role=switch]').click()");await delay(180);
  await click('Next');await observe('reviewCustom', "document.querySelector('main').innerText");
  await snap('desktop-review');
  await click('Connect Wallet to Launch');await wait("document.querySelector('.wallet-adapter-modal')");await delay(700);await snap('wallet-selector');
  await observe('walletPickerStyle', `(()=>{const s=getComputedStyle(document.querySelector('.wallet-adapter-modal-list .wallet-adapter-button'));return {color:s.color,image:s.backgroundImage,background:s.backgroundColor}})()`);
  await click('Phantom');
  await wait("document.querySelector('button') && [...document.querySelectorAll('button')].some(x=>x.textContent.includes('Create $AUDIT'))");
  await observe('publicFee', "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create $AUDIT')).textContent");
  results.observations.uploadMode = 'failure';await click('Create $AUDIT');await wait("document.querySelector('[role=dialog]')?.textContent.includes('AUDIT: upload unavailable')");await snap('upload-error');
  await check('upload error retained zero signing', 'window.__auditSigns===0');
  results.observations.uploadMode = 'success';await click('Try Again');await wait("document.querySelector('[role=dialog]')?.textContent.includes('AUDIT: wallet declined')");
  await check('retry reached wallet rejection', 'window.__auditSigns===1');await snap('wallet-rejection');await click('Close');
  await ev(`window.__auditWalletBytes=${JSON.stringify(adminBytes)};window.__auditListeners.accountChanged(window.phantom.solana.publicKey)`);await delay(300);
  await observe('adminFee', "({button:[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create $AUDIT'))?.textContent,badge:document.querySelector('header').innerText})");
  await click('Mainnet');await delay(200);await observe('networkPreservation', "({name:window.__auditFiber('CreatorPage').memoizedState.memoizedState.name,button:[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create $AUDIT'))?.textContent})");
  for (const [width,height] of [[390,844],[320,640],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });await ev('scrollTo(0,0)');await delay(250);await snap(`page-${width}x${height}`, width===390);
    await observe(`bounds-${width}`, `({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headerHeight:document.querySelector('header').getBoundingClientRect().height,overflow:[...document.querySelectorAll('main input,main button,header button')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth||r.left<0}).map(e=>({text:e.textContent,id:e.id,rect:e.getBoundingClientRect().toJSON()}))})`);
  }
  // Exercise real LaunchModal with controlled React state. No transaction/signing.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await ev(`window.__auditState('CreatorPage',5,{mintAddress:'So11111111111111111111111111111111111111112',signature:'1'.repeat(88)});window.__auditState('CreatorPage',2,'success');window.__auditState('CreatorPage',1,true)`);await delay(350);await snap('success-390');
  for (const [width,height] of [[390,844],[320,640],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });await delay(150);
    await observe(`success-${width}`, `(()=>{const e=document.querySelector('[role=dialog]');return {rect:e.getBoundingClientRect().toJSON(),client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY,text:e.innerText,unlabeled:[...e.querySelectorAll('button,input')].filter(x=>!x.textContent.trim()&&!x.getAttribute('aria-label')&&!x.labels?.length).map(x=>x.tagName)}})()`);
    await snap(`success-${width}x${height}`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await ev("window.__auditState('CreatorPage',1,false)");await delay(250);await ev('scrollTo(0,450)');
  const before = (await cdp('Performance.getMetrics')).metrics;
  await ev(`new Promise(resolve=>{const card=[...document.querySelectorAll('div')].find(e=>e.style.transformStyle==='preserve-3d'&&e.onmousemove);const target=document.querySelector('[style*="perspective"]')?.firstElementChild;const r=target.getBoundingClientRect();let i=0;function step(){target.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.x+r.width/2+Math.sin(i)*100,clientY:r.y+r.height/2}));if(++i<120)requestAnimationFrame(step);else resolve()}target.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));step()})`);
  const after = (await cdp('Performance.getMetrics')).metrics;
  results.observations.pointerMetrics = Object.fromEntries(after.filter(x=>['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','ScriptDuration','TaskDuration'].includes(x.name)).map(x=>[x.name,x.value-before.find(y=>y.name===x.name).value]));
  await observe('previewTransforms', "[...document.querySelectorAll('[style*=translateZ]')].map(e=>({text:e.innerText?.slice(0,50),inline:e.style.transform,computed:getComputedStyle(e).transform,animation:getComputedStyle(e).animationName}))");
  await snap('preview-hover');
  await ev("window.__auditWalletBytes="+JSON.stringify(publicBytes)+";window.__auditListeners.accountChanged(window.phantom.solana.publicKey)");
  await delay(200);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  for (let step=1;step<=4;step++) {
    await ev(`document.querySelector('[aria-label^="Step ${step}:"]').click()`);await delay(200);
    await ev(`document.querySelector('[aria-label^="Step ${step}:"]').scrollIntoView({block:'start'})`);await snap(`step-${step}-390`);
    if(step===1) await observe('headerAfterScroll', `({scrollY,headerTop:document.querySelector('header').getBoundingClientRect().top,ancestorOverflow:getComputedStyle(document.querySelector('#root').firstElementChild).overflowY})`);
    if(step===2) await observe('uploadKeyboard', `({display:getComputedStyle(document.querySelector('#image-upload')).display,labelTab:document.querySelector('[role="button"][aria-label^="Upload token logo"]').tabIndex})`);
  }
  await ev("document.querySelector('[aria-label^=\"Step 3:\"]').click()");await delay(200);
  await ev("document.querySelector('[role=switch]').click()");await delay(150);
  await ev("document.querySelector('[aria-label^=\"Step 4:\"]').click()");await delay(200);
  await observe('publicBaseFee', "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create $AUDIT'))?.textContent");
  await observe('switchLabels', "[...document.querySelectorAll('label[for*=switch]')].map(x=>({for:x.htmlFor,text:x.textContent}))");
  await ev("document.querySelector('[aria-label^=\"Step 3:\"]').click()");await delay(200);
  await ev("document.querySelectorAll('[role=switch]').forEach(e=>{if(e.getAttribute('aria-checked')==='true')e.click()})");await delay(200);
  await ev("document.querySelector('[aria-label^=\"Step 4:\"]').click()");await delay(200);
  await observe('publicAllCustomFee', "[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create $AUDIT'))?.textContent");
  await observe('faqBefore', "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('How much does'));return {expanded:b.getAttribute('aria-expanded'),parentHeight:b.parentElement.clientHeight}})()");
  await click('How much does');
  await observe('faqAfter', "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('How much does'));return {expanded:b.getAttribute('aria-expanded'),parentHeight:b.parentElement.clientHeight}})()");
  await ev("window.__auditState('CreatorPage',2,'uploading');window.__auditState('CreatorPage',1,true)");await delay(150);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await check('busy Escape kept dialog open', "!!document.querySelector('[role=dialog]')");
  for(let i=0;i<6;i++) { await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); }
  await check('busy keyboard focus contained', "document.querySelector('[role=dialog]').contains(document.activeElement)");await snap('busy-390');
  await ev("window.__auditState('CreatorPage',4,{message:'AUDIT: confirmation timeout',signature:'1'.repeat(88),launchContext:{mintAddress:'So11111111111111111111111111111111111111112',signature:'1'.repeat(88)}});window.__auditState('CreatorPage',2,'error')");await delay(200);await snap('broadcast-error-390');
  await click('Check Confirmation Status');await wait("document.querySelector('[role=dialog]')?.innerText.includes('is Live!')");
  await observe('recoveryPanels', "document.querySelector('[role=dialog]').innerText");await snap('recovered-390');
  await ev("window.__auditState('CreatorPage',2,'uploading');window.__auditState('CreatorPage',5,null)");await delay(200);
  await observe('newLaunchAfterRecovery', "({oldSuccess:document.querySelector('[role=dialog]').innerText.includes('is Live!'),working:document.querySelector('[role=dialog]').innerText.includes('Deploying $')})");await snap('recovery-stale-next-launch');
  await observe('colors', `(()=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};return {footer:rgb(getComputedStyle(document.querySelector('footer p:last-child')).color),bodyFooter:rgb(getComputedStyle(document.querySelector('footer p')).color),wallet:rgb(getComputedStyle(document.querySelector('.wallet-adapter-button')).color),walletBg:rgb(getComputedStyle(document.querySelector('.wallet-adapter-button')).backgroundColor)}})()`);
  // Round 2: whole-owner boundary checks beyond the former happy-path symptoms.
  await observe('beamRound2', `(()=>{const e=document.querySelector('[style*="--size"]');return [e,e?.querySelector('.border-beam-active')].map(x=>{if(!x)return null;const s=getComputedStyle(x,'::after');return {class:x.className,content:s.content,animation:s.animationName,duration:s.animationDuration,width:s.width,path:s.offsetPath,background:s.backgroundImage,distance:s.offsetDistance}})})()`);
  await cdp('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  await observe('reducedMotionRound2', `({animations:document.getAnimations().map(a=>({name:a.animationName,target:a.effect.target?.className,iterations:a.effect.getTiming().iterations})),canvases:document.querySelectorAll('canvas').length})`);
  await ev(`(()=>{const t=document.querySelector('[style*="perspective"]')?.firstElementChild;const r=t.getBoundingClientRect();t.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));t.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.right-2,clientY:r.bottom-2}));})()`);await delay(300);
  await observe('reducedMotionTilt', `document.querySelector('[style*="perspective"]')?.firstElementChild.style.transform`);
  await ev(`window.__auditState('CreatorPage',2,'success');window.__auditState('CreatorPage',5,{mintAddress:'So11111111111111111111111111111111111111112',signature:'1'.repeat(88)})`);await delay(100);
  await observe('reducedMotionConfetti', `({canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height,position:getComputedStyle(e).position})),animations:document.getAnimations().map(a=>a.animationName)})`);
  await ev(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('AUDIT: clipboard denied')}}})`);
  await ev(`document.querySelector('[aria-label="Copy token mint address to clipboard"]').click()`);await delay(150);
  await observe('clipboardDenied', `({copied:document.querySelector('[role=dialog]').innerText.includes('Copied to clipboard'),text:document.querySelector('[role=dialog]').innerText})`);
  await ev(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});document.querySelector('[aria-label="Copy token mint address to clipboard"]').click()`);await delay(100);
  await observe('clipboardAllowed', `document.querySelector('[role=dialog]').innerText.includes('Copied to clipboard')`);
  await ev(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.querySelector('[aria-label="Copy token mint address to clipboard"]').click()`);await delay(100);
  await observe('clipboardUnavailable', `document.querySelector('[role=dialog]').innerText.includes('Copy failed. Please copy manually.')`);
  await ev(`window.__auditState('CreatorPage',2,'uploading');window.__auditState('CreatorPage',5,null)`);await delay(100);
  await ev(`window.__auditState('CreatorPage',4,{message:'AUDIT: old attempt timeout',signature:'1'.repeat(88),launchContext:{mintAddress:'So11111111111111111111111111111111111111112',signature:'1'.repeat(88)}});window.__auditState('CreatorPage',2,'error')`);await delay(100);
  results.observations.recoveryMode = 'pending';await click('Check Confirmation Status');
  await observe('recoveryPending', `document.querySelector('[role=dialog]').innerText`);
  results.observations.recoveryMode = 'failed';await click('Check Confirmation Status');
  await observe('recoveryFailed', `document.querySelector('[role=dialog]').innerText`);
  results.observations.recoveryMode = 'rpc_unavailable';await click('Check Confirmation Status');await observe('recoveryUnavailable',`document.querySelector('[role=dialog]').innerText`);
  results.observations.recoveryMode = 'not_found';await click('Check Confirmation Status');await observe('recoveryNotFound',`document.querySelector('[role=dialog]').innerText`);
  results.observations.recoveryMode = 'confirmed';results.observations.rpcDelayMs = 1000;
  await click('Check Confirmation Status');
  await ev(`window.__auditState('CreatorPage',2,'uploading');window.__auditState('CreatorPage',5,null)`);await delay(1300);
  await observe('lateRecoveryAfterNewAttempt', `({working:document.querySelector('[role=dialog]').innerText.includes('Deploying $'),oldSuccess:document.querySelector('[role=dialog]').innerText.includes('is Live!'),mint:document.querySelector('[role=dialog] input')?.value,text:document.querySelector('[role=dialog]').innerText})`);await snap('late-recovery-after-new-attempt');
  // Changing the signature while status stays "error" must also invalidate the waiter.
  const setError = signature => ev(`window.__auditState('CreatorPage',4,{message:'AUDIT: timeout',signature:${JSON.stringify(signature)},launchContext:{mintAddress:'So11111111111111111111111111111111111111112',signature:${JSON.stringify(signature)}}});window.__auditState('CreatorPage',2,'error')`);
  await setError('1'.repeat(88));await delay(100);await click('Check Confirmation Status');
  await setError('2'.repeat(88));await delay(1300);
  await observe('changedSignature', `({success:document.querySelector('[role=dialog]').innerText.includes('is Live!'),checking:document.querySelector('[role=dialog]').innerText.includes('Checking...'),current:document.querySelector('[role=dialog]').innerText.includes('${'2'.repeat(88)}')})`);
  await click('Check Confirmation Status');await click('Devnet');await delay(1300);
  await observe('changedConnection', `({success:document.querySelector('[role=dialog]').innerText.includes('is Live!'),checking:document.querySelector('[role=dialog]').innerText.includes('Checking...')})`);
  await click('Check Confirmation Status');await click('Close');
  await ev(`window.__auditState('CreatorPage',1,true)`);await delay(1300);
  await observe('reopenedOwner', `({success:document.querySelector('[role=dialog]').innerText.includes('is Live!'),checking:document.querySelector('[role=dialog]').innerText.includes('Checking...')})`);
  results.observations.rpcDelayMs=0;
  await ev(`window.__auditState('CreatorPage',4,{message:'AUDIT: no mint context',signature:'3'.repeat(88)})`);await delay(100);await click('Check Confirmation Status');
  await observe('missingMintContext', `({success:document.querySelector('[role=dialog]').innerText.includes('is Live!'),text:document.querySelector('[role=dialog]').innerText})`);
  await cdp('Emulation.setEmulatedMedia', {features:[]});
  await ev(`window.__auditState('CreatorPage',1,false)`);await delay(200);
  await ev(`document.querySelector('[aria-label^="Step 2:"]').click()`);await delay(100);
  await observe('uploadKeyboardRound2', `(()=>{const e=document.querySelector('[role="button"][aria-label^="Upload token logo"]');return {tab:e.tabIndex,role:e.getAttribute('role'),name:e.textContent}})()`);
  await observe('socialAndMintNames', `({social:[...document.querySelectorAll('input[type=url]')].map(e=>({name:e.name,label:e.getAttribute('aria-label')})),steps:[...document.querySelectorAll('[aria-label^="Step "]')].map(e=>({label:e.getAttribute('aria-label'),disabled:e.disabled,ariaDisabled:e.getAttribute('aria-disabled')}))})`);
  await ev(`window.__auditPickerCalls=0;document.querySelector('#image-upload').click=()=>window.__auditPickerCalls++;document.querySelector('[role="button"][aria-label^="Upload token logo"]').focus()`);
  for(const key of ['Enter',' ']) {await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key==='Enter'?'Enter':'Space',windowsVirtualKeyCode:key==='Enter'?13:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key==='Enter'?'Enter':'Space',windowsVirtualKeyCode:key==='Enter'?13:32});}
  await observe('keyboardPickerCalls','window.__auditPickerCalls');
  await field('twitter','https://example.invalid/twitter');await field('telegram','https://t.me/audit');
  await observe('socialColors',`[...document.querySelectorAll('[title="https://t.me/audit"],[title="https://example.invalid/twitter"]')].map(e=>({title:e.title,color:getComputedStyle(e).color}))`);
  await observe('socialNames',`[...document.querySelectorAll('[name="website"],[name="twitter"],[name="telegram"],[name="discord"]')].map(e=>({name:e.name,label:e.getAttribute('aria-label')}))`);
  await snap('social-palette');
  await ev(`(()=>{window.__auditBlobs={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(file)=>{const u=create(file);window.__auditBlobs.created.push(u);return u};URL.revokeObjectURL=(u)=>{window.__auditBlobs.revoked.push(u);revoke(u)};window.__auditState('CreatorPage',0,p=>({...p,image:new File(['audit'],'replacement.png',{type:'image/png'})}));})()`);await delay(200);
  await ev(`window.__auditState('CreatorPage',0,p=>({...p,image:null}))`);await delay(200);
  await observe('blobLifecycle',`({created:window.__auditBlobs.created.length,revokedOwned:window.__auditBlobs.created.filter(u=>window.__auditBlobs.revoked.includes(u)).length})`);
  await ev(`document.querySelector('[aria-label^="Step 3:"]').click()`);await delay(150);
  await observe('switchStyles',`[...document.querySelectorAll('[role="switch"]')].map(e=>{const s=getComputedStyle(e);return {checked:e.getAttribute('aria-checked'),width:e.offsetWidth,height:e.offsetHeight,bg:s.backgroundColor,image:s.backgroundImage,thumb:getComputedStyle(e.firstElementChild).backgroundColor}})`);
  await ev(`document.querySelector('[role="switch"]').focus()`);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await observe('keyboardFocusStyle',`({role:document.activeElement.getAttribute('role'),ring:getComputedStyle(document.activeElement).boxShadow})`);
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('How much does'));b.focus();window.__faqBefore=b.getAttribute('aria-expanded')})()`);
  for(const key of ['Enter',' ']) {await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key==='Enter'?'Enter':'Space',windowsVirtualKeyCode:key==='Enter'?13:32});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key==='Enter'?'Enter':'Space',windowsVirtualKeyCode:key==='Enter'?13:32});await delay(100);await observe('faqKey'+(key===' '?'Space':key),`document.activeElement.getAttribute('aria-expanded')`);}
  await observe('idsAfterMultipleCoins',`[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i)`);
  await observe('fontFamilies',`[...new Set([...document.querySelectorAll('header,main input,main button,footer')].map(e=>getComputedStyle(e).fontFamily))]`);
  await observe('finalSourceHashes', 'true');
  results.finalSources={};for(const p of Object.keys(results.sources)) results.finalSources[p]=createHash('sha256').update(await readFile(p)).digest('hex');
} catch (e) { results.fatal = e.stack; try { await snap('fatal'); results.observations.fatalBody = await ev('document.body.innerText'); } catch {} process.exitCode = 1; }
finally {
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2));
  try { if (ws?.readyState===1) cdp('Browser.close').catch(()=>{}); } catch {}
  ws?.close(); clearTimeout(deadline); chrome.kill(); await new Promise(resolve=>server.httpServer.close(resolve));
  console.log(JSON.stringify({ checks: results.checks, fatal: results.fatal, evidence: out.pathname }));
}


