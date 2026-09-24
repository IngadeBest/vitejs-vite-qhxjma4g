import { describe, it, expect } from 'vitest';
import { readLocalProtocol, saveProtocol } from './protocolPersistence';
describe('protocol persistence', () => {
 it('recognizes old class labels and keeps local data intact', () => {
  localStorage.clear();
  localStorage.setItem('protocol_items_w_WE0_Stijltrail', '["Brug"]');
  expect(readLocalProtocol(localStorage,'w','we0')).toEqual(['Brug']);
  expect(readLocalProtocol(localStorage,'other','we0')).toBeNull();
  expect(localStorage.getItem('protocol_items_w_WE0_Stijltrail')).toBe('["Brug"]');
 });
 it('does not claim success after rejection or an incomplete response', async () => {
  await expect(saveProtocol({rpc:async()=>({error:new Error('Geen beheerrechten')})},'w','we0',['Brug'],null)).rejects.toThrow('Geen beheerrechten');
  await expect(saveProtocol({rpc:async()=>({data:[]})},'w','we0',['Brug'],null)).rejects.toThrow('bevestigd');
 });
});
