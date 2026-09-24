import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { requireClass, normalizeComponent, entryIdentity } from '../rules/weh/classes.js';
import { dressageTest, dressageMaximum } from '../rules/weh/dressage.js';
import { styleRules, styleMaximum } from '../rules/weh/styleTrail.js';
import { speedEventRules } from '../rules/weh/speedTrail.js';
import { validateCourse } from '../rules/weh/obstacles.js';
import { WEH_METADATA } from '../rules/weh/metadata.js';
import { padStartnummer } from '../lib/startnummer.js';
const BLUE = [16, 39, 84];
// Source PDFs wrap words to narrow columns. Reflow that text for our own columns.
const reflow = value => String(value || '').replace(/\s+/g, ' ').trim();
export function buildWehProtocolPdf(p, items = [], existingDoc = null) {
 const c = requireClass(p.klasse), component = normalizeComponent(p.onderdeel);
 if (!c.requiredComponents.includes(component)) throw new Error('Onderdeel niet toegestaan voor deze klasse.');
 const identity = entryIdentity(p.klasse, p.rubriek);
 const doc = existingDoc || new jsPDF({ unit: 'pt', format: 'a4' });
 const firstPage = doc.internal.getCurrentPageInfo().pageNumber;
 const startnummer = padStartnummer(p.startnummer);
 const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
 const table = options => autoTable(doc, { margin: {left:36,right:36,top:54,bottom:48},
  styles:{ fontSize:8.5,cellPadding:5,lineWidth:0.4,lineColor:[170,170,170],overflow:'linebreak',valign:'middle'},
  headStyles:{fillColor:BLUE,textColor:255},theme:'grid',rowPageBreak:'avoid', ...options });
 doc.setFillColor(...BLUE);doc.rect(0,0,width,44,'F');doc.setTextColor(255);doc.setFontSize(16);
 doc.text(`Working Point | ${component}`,36,28);doc.setTextColor(0);
 table({startY:54, body:[
  ['Wedstrijd',p.wedstrijd_naam || '', 'Datum', p.datum || ''],
  ['Klasse',c.naam,'Rubriek',identity.section === 'jeugd' ? 'Jeugd' : (p.rubriek || 'Algemeen')],
  ['Ruiter',p.ruiter || '', 'Startnummer',startnummer],
  ['Paard',p.paard || '', 'Jury',p.jury || ''],
  ['Percentage',p.percentage || '', 'Plaatsing',p.plaatsing || ''],
 ],columnStyles:{0:{cellWidth:60,fontStyle:'bold'},1:{cellWidth:190},2:{cellWidth:72,fontStyle:'bold'}}});
 let y=doc.lastAutoTable.finalY+12, max=null;
 if(component==='Dressuur') {
  const test=dressageTest(c.code);max=dressageMaximum(c.code);
  table({startY:y, head:[['Nr.','Letters','Oefening / beoordelingscriteria','C.','Heel','Half','Correctie','Opmerkingen']],
   styles:{fontSize:8,cellPadding:4,lineWidth:0.4,lineColor:[170,170,170],overflow:'linebreak',valign:'middle'},
   body:test.items.map(r=>[r.number,r.letters,`${reflow(r.text)}${r.criteria ? '\n'+reflow(r.criteria) : ''}`,String(r.coefficient),'','','','']),
   columnStyles:{0:{cellWidth:25},1:{cellWidth:42},2:{cellWidth:238,minCellHeight:28},3:{cellWidth:23},4:{cellWidth:25},5:{cellWidth:25},6:{cellWidth:45}},
   didParseCell:({section,row,cell})=>{if(section==='body' && test.items[row.index]?.kind==='general')cell.styles.fillColor=[235,241,250];}});
  y=doc.lastAutoTable.finalY+10;
  table({startY:y,pageBreak:'avoid',body:[['Proef / uitvoering',`${test.version}. ${test.lettersRequired?'Met letters':'Lettervrij'}; ${test.handUse==='one'?'eenhandig':test.handUse==='two'?'tweehandig':'een- of tweehandig'}. ${test.readAloudAllowed?'Voorlezen toegestaan.':'Uit het hoofd.'} ${test.timeLimitSeconds ? `Maximaal ${test.timeLimitSeconds/60} minuten.` : test.suggestedTimeSeconds ? `Circa ${test.suggestedTimeSeconds/60} minuten.` : ''}`],['Start / vergissingen','Start binnen 60 seconden na de bel; eigen muziek. Eerste vergissing: -5; tweede: -5; derde: diskwalificatie.']],columnStyles:{0:{cellWidth:90}}});
 } else if(component==='Stijltrail') {
  const validation=validateCourse(c.code,component,items);
  if(!validation.valid) throw new Error(validation.errors.join(' '));
  const rules=styleRules(c.code);max=styleMaximum(c.code,items.length);
  table({startY:y,head:[['Nr.','Hindernis / algemeen cijfer','Heel','Half','Correctie','Opmerkingen']],
   styles:{fontSize:8,cellPadding:5,lineWidth:0.4,lineColor:[170,170,170],overflow:'linebreak',valign:'middle'},
   body:[['','Groeten / startlijn passeren','—','—','—',''],...items.map((r,i)=>[String(i+1),typeof r==='string'?r:r.officialName||r.name||r.obstacleId,'','','','']),['','Finishlijn passeren / groeten','—','—','—',''],...rules.generalPoints.map((r,i)=>[String(items.length+i+1),r,'','','',''])],
   columnStyles:{0:{cellWidth:28},1:{cellWidth:225,minCellHeight:items.length>10?20:26},2:{cellWidth:28},3:{cellWidth:28},4:{cellWidth:45}}});
 } else {
  table({startY:y,head:[['Correctie','Regel','Aantal','Seconden / opmerking']],
   body:speedEventRules(c.code).filter(r=>r.kind!=='disqualification').map(r=>[
    r.label,r.kind==='review'?`REVIEW REQUIRED: ${r.reviewRequired}`:r.kind==='disqualification'?'DQ':`${r.kind==='bonus'?'-':'+'}${r.seconds} sec${r.decisionStatus === 'user_agreed_pending_weh' ? ' (werkafspraak; WEH volgt)' : ''}`,'','']),
   columnStyles:{0:{cellWidth:180},1:{cellWidth:160},2:{cellWidth:36}}});
 }
 y=doc.lastAutoTable.finalY+12;
 const totals = component==='Speedtrail' ? [['Gereden tijd',''],['Straftijd (+)',''],['Bonustijd (-)',''],['Eindtijd = gereden + straf - bonus',''],['Status: uitgereden / DQ / eliminatie / niet gestart','']] : [['Maximumscore',String(max)],['Subtotaal',''],['Puntenaftrek en reden',''],['Totaal / percentage',''],['Status: uitgereden / DQ / eliminatie / niet gestart','']];
 totals.push([{content:'Naam en handtekening jury',styles:{minCellHeight:40}},'']);
 table({startY:y,pageBreak:'avoid',columnStyles:{0:{cellWidth:280},1:{cellWidth:'auto',minCellHeight:23}},body:totals});
 if(component==='Speedtrail') {
  doc.addPage();
  table({startY:54,head:[['Diskwalificatie: aankruisen indien van toepassing','DQ']],body:speedEventRules(c.code).filter(r=>r.kind==='disqualification').map(r=>[r.label,'']),columnStyles:{0:{cellWidth:470,minCellHeight:29}}});
  table({startY:doc.lastAutoTable.finalY+16,body:[['Toelichting jury / hindernisnummer','']],columnStyles:{0:{cellWidth:170}},styles:{fontSize:9,cellPadding:10,minCellHeight:100}});
 }
 const count=doc.internal.getNumberOfPages();
 for(let i=firstPage;i<=count;i++) {
  doc.setPage(i);
  if(i>firstPage) {
   doc.setFillColor(...BLUE);doc.rect(0,0,width,38,'F');doc.setTextColor(255);doc.setFontSize(10);
   doc.text(`Working Point | ${component} | ${c.naam}`,36,16);
   doc.setFontSize(9);doc.text(doc.splitTextToSize(`${startnummer}  ${p.ruiter || ''} / ${p.paard || ''}`,width-72)[0],36,30);
  }
  doc.setDrawColor(190);doc.line(36,height-35,width-36,height-35);
  doc.setFontSize(7);doc.setTextColor(80);doc.text(`WEH ${WEH_METADATA.rulebookVersion} | ${c.naam} | Startnr. ${startnummer}`,36,height-24);
  doc.text(`${i-firstPage+1}/${count-firstPage+1}`,width-52,height-24);
 }
 return doc;
}
