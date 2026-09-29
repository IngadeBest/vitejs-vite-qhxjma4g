import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import ClassificationFields from './ClassificationFields';
it('offers one WE0 choice and permits a separate Jeugd assignment',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
 function Editor(){const [form,setForm]=useState({klasse:'we0',rubriek:'Algemeen'});return <><ClassificationFields form={form} onChange={setForm}/><output>{form.klasse}:{form.rubriek}</output></>;}
 try{
  await act(async()=>root.render(<Editor/>));
  const classes=container.querySelector('[aria-label="Klasse"]');
  expect([...classes.options].filter(o=>o.textContent.includes('WE0'))).toHaveLength(1);
  expect([...classes.options].some(o=>o.textContent==='Junioren')).toBe(true);
  const section=container.querySelector('[aria-label="Rubriek"]');
  await act(async()=>{section.value='Jeugd';section.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelector('output').textContent).toBe('we0:Jeugd');
  await act(async()=>{section.value='Algemeen';section.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.querySelector('output').textContent).toBe('we0:Algemeen');
 } finally {await act(async()=>root.unmount());container.remove();}
});
