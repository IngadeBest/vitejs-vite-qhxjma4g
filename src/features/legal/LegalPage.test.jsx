import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import LegalPage from './LegalPage';
import { AcceptanceEvidence } from './TermsAcceptanceCard';
import { termsDocument, privacyDocument, documentText } from './legalContent';
import { TERMS_VERSION } from './termsAcceptance';
it.each([false,true])('renders readable legal document (privacy=%s) with matching downloadable copy',async privacy=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const node=document.createElement('div'); const root=createRoot(node);
 try {
 await act(async()=>root.render(<LegalPage privacy={privacy} />));
 const doc=privacy?privacyDocument:termsDocument;
 expect(node.querySelector('h1').textContent).toBe(doc.title); expect(doc.version).toBe(TERMS_VERSION);
 expect(node.querySelectorAll('section')).toHaveLength(doc.sections.length);
 expect(node.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
 const download=node.querySelector('[download]').getAttribute('href');
 expect(readFileSync(`public${download}`,'utf8')).toBe(documentText(doc));
 } finally {await act(async()=>root.unmount());}
});
it('does not imply historical consent and displays original evidence in Amsterdam time',async()=>{
 const node=document.createElement('div'); const root=createRoot(node);
 try {
 await act(async()=>root.render(<AcceptanceEvidence registration={{}} />));
 expect(node.textContent).toContain('Geen voorwaardenacceptatie geregistreerd');
 await act(async()=>root.render(<AcceptanceEvidence registration={{terms_accepted:true,terms_version:TERMS_VERSION,terms_accepted_at:'2026-10-07T12:32:00Z'}} />));
 expect(node.textContent).toContain('14:32'); expect(node.textContent).toContain(TERMS_VERSION);
 } finally {await act(async()=>root.unmount());}
});
