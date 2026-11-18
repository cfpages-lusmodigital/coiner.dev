// Run the browser probe first. Never interpret its zero exit as redesign acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const r = JSON.parse(fs.readFileSync('scratch/sol_ui_repair_evidence/results.json', 'utf8'));
assert(!r.fatal, r.fatal);
for (const [p, hash] of Object.entries(r.sources)) {
  assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'), hash, `Stale source: ${p}`);
  assert.equal(r.finalSources[p], hash, `Concurrent source change: ${p}`);
}
assert(r.checks.every(c => c.ok), 'Positive control failed');
const o = r.observations;
const initialRequests = r.initialRequests;
const js = r.bundle.filter(b => b.name.endsWith('.js') && initialRequests.includes('/assets/' + b.name)).reduce((s,b) => s+b.gzip,0);
const gates = {
  U01: [320,390,844].every(w => o['bounds-'+w].overflow.length === 0) && o.headerAfterScroll.headerTop === 0 && [320,844].every(w => {const s=o['success-'+w];return s.rect.top>=0&&s.overflow==='auto';}),
  U02: !o.newLaunchAfterRecovery.oldSuccess && !o.lateRecoveryAfterNewAttempt.oldSuccess && o.changedSignature.current && [o.changedSignature,o.changedConnection,o.reopenedOwner].every(x=>!x.success&&!x.checking) && !o.missingMintContext.success && o.missingMintContext.text.includes('Do not retry.') && !o.recoveryPending.includes('Try Again') && !o.recoveryUnavailable.includes('Try Again') && !o.recoveryNotFound.includes('Try Again') && o.recoveryFailed.includes('Try Again'),
  U03: !o.reducedMotion.animations.length && !o.settledDecoration.length && !o.reducedMotionConfetti.canvases.length && /rotateY\(0deg\) rotateX\(0deg\)/.test(o.reducedMotionTilt),
  U04: o.walletPickerStyle.image==='none' && o.walletPickerStyle.background==='rgb(17, 24, 39)',
  U05: o.switchStyles.every(s => s.width>=44&&s.height>=44),
  U06: o.lockedSteps && o.keyboardPickerCalls===2 && o['success-320'].unlabeled.length===0,
  U07: o.faqBefore.expanded==='false'&&o.faqAfter.expanded==='true'&&o.faqKeyEnter==='false'&&o.faqKeySpace==='true',
  U08: o.beamRound2[0].animation!=='none' && o.beamStart!==o.beamMoved,
  U09: o.previewTransforms.some(t=>t.inline.includes('translateZ(100px)')&&t.computed.startsWith('matrix3d(')&&t.animation==='none'),
  U10: js<200*1024,
  U11: o.blobLifecycle.created>0&&o.blobLifecycle.revokedOwned===o.blobLifecycle.created,
  U12: o.clipboardAllowed&&o.clipboardUnavailable&&!o.clipboardDenied.copied&&/denied|unable to copy|copy failed/i.test(o.clipboardDenied.text),
  U13: o.initial.ids.length===0&&o.idsAfterMultipleCoins.length===0,
};
console.log(JSON.stringify({gates,initialJsGzipBytes:js,manualGates:['U04 contrast','U14 documentation','palette'],note:'This is a source-bound local browser audit, not an on-chain or production certificate.'},null,2));
assert(Object.values(gates).every(Boolean), 'COINER-UI-REDESIGN-2: unresolved findings; acceptance withheld');
