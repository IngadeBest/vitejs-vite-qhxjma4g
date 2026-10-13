import React from 'react';
import Container from '@/ui/Container';
import { termsDocument, privacyDocument } from './legalContent';
import { TERMS_URL, PRIVACY_URL } from './termsAcceptance';
import './legal.css';

export function LegalFooter() {
  return <footer className="wp-legal-footer"><a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Algemene voorwaarden</a><a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacyverklaring</a></footer>;
}
export default function LegalPage({ privacy = false }) {
  const document = privacy ? privacyDocument : termsDocument;
  return <Container maxWidth={960}><article className="wp-legal-page">
    <header><p className="wp-legal-version">Working Point · Versie {document.version}</p><h1>{document.title}</h1>
      <div className="wp-legal-actions"><button type="button" onClick={() => window.print()}>Afdrukken / opslaan als PDF</button><a download href={`/juridisch/${privacy ? 'privacy' : 'algemene-voorwaarden'}-${document.version}.txt`}>Download tekst</a></div>
    </header>
    <p>{document.introduction}</p>
    <nav aria-label="Inhoud van deze pagina"><ul className="wp-legal-toc">{document.sections.map((section, i) => <li key={i}><button type="button" onClick={() => { const heading = window.document.getElementById(`legal-section-${i + 1}`); heading?.focus(); heading?.scrollIntoView({ behavior: 'smooth' }); }}>{section.title}</button></li>)}</ul></nav>
    {document.sections.map((section, i) => <section key={i}><h2 id={`legal-section-${i + 1}`} tabIndex={-1}>{section.title}</h2>{section.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}{section.items && <ul>{section.items.map(p => <li key={p}>{p}</li>)}</ul>}{section.after?.map((p, j) => <p key={j}>{p}</p>)}</section>)}
    <p>Vragen? <a href="mailto:info@workingpoint.nl">info@workingpoint.nl</a>. Een klacht over persoonsgegevens kun je indienen bij de <a href="https://autoriteitpersoonsgegevens.nl/een-tip-of-klacht-indienen-bij-de-ap" target="_blank" rel="noopener noreferrer">Autoriteit Persoonsgegevens</a>.</p>
  </article></Container>;
}
