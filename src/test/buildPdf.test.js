import { describe, it, expect } from 'vitest';
import { buildProtocolPdf, generatePdfBlob, KLASSEN, ONDERDELEN } from '../pdf/buildPdf';
import {
  fixture_we0_dressuur,
  fixture_we1_stijl,
  fixture_we2_speed,
  fixture_we3_dressuur,
  fixture_jeugd_we1_stijl,
  fixture_we2plus_dressuur,
} from './fixtures/protocol-fixtures';

describe('Protocol PDF Generation', () => {
  describe('buildProtocolPdf', () => {
    it('should generate WE0 dressuur protocol', () => {
      const { protocol, items } = fixture_we0_dressuur;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate WE1 stijltrail protocol', () => {
      const { protocol, items } = fixture_we1_stijl;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate WE2 speedtrail protocol', () => {
      const { protocol, items } = fixture_we2_speed;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate WE3 dressuur protocol', () => {
      const { protocol, items } = fixture_we3_dressuur;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate jeugd WE1 stijl protocol', () => {
      const { protocol, items } = fixture_jeugd_we1_stijl;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate WE2+ dressuur protocol', () => {
      const { protocol, items } = fixture_we2plus_dressuur;
      const doc = buildProtocolPdf(protocol, items);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });
  });

  describe('generatePdfBlob', () => {
    it('should generate a valid blob for WE0 dressuur', async () => {
      const { protocol, items } = fixture_we0_dressuur;
      const blob = await generatePdfBlob(protocol, items);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should generate a valid blob for WE1 stijl', async () => {
      const { protocol, items } = fixture_we1_stijl;
      const blob = await generatePdfBlob(protocol, items);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should generate a valid blob for WE2 speed', async () => {
      const { protocol, items } = fixture_we2_speed;
      const blob = await generatePdfBlob(protocol, items);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('Constants', () => {
    it('should export KLASSEN array', () => {
      expect(KLASSEN).toBeDefined();
      expect(Array.isArray(KLASSEN)).toBe(true);
      expect(KLASSEN.length).toBeGreaterThan(0);
      expect(KLASSEN[0]).toHaveProperty('code');
      expect(KLASSEN[0]).toHaveProperty('naam');
    });

    it('should export ONDERDELEN array', () => {
      expect(ONDERDELEN).toBeDefined();
      expect(Array.isArray(ONDERDELEN)).toBe(true);
      expect(ONDERDELEN.length).toBe(3);
      expect(ONDERDELEN[0]).toHaveProperty('code');
      expect(ONDERDELEN[0]).toHaveProperty('label');
    });

    it('should have correct klasse codes', () => {
      const codes = KLASSEN.map(k => k.code);
      expect(codes).toContain('we0');
      expect(codes).toContain('we1');
      expect(codes).toContain('we2');
      expect(codes).toContain('we3');
      expect(codes).toContain('we4');
    });

    it('should have correct onderdeel codes', () => {
      const codes = ONDERDELEN.map(o => o.code);
      expect(codes).toContain('dressuur');
      expect(codes).toContain('stijl');
      expect(codes).toContain('speed');
    });
  });

  describe('PDF Content Validation', () => {
    it('should include protocol metadata in WE0 dressuur', () => {
      const { protocol, items } = fixture_we0_dressuur;
      const doc = buildProtocolPdf(protocol, items);
      const pdfOutput = doc.output('datauristring');
      
      // Basic validation dat PDF data bevat (base64-encoded)
      expect(pdfOutput).toMatch(/^data:application\/pdf;filename=generated\.pdf;base64,/);
      expect(pdfOutput.length).toBeGreaterThan(1000);
    });

    it('should handle empty items array gracefully', () => {
      const { protocol } = fixture_we0_dressuur;
      const doc = buildProtocolPdf(protocol, []);
      
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    });

    it('should generate different content for different protocols', () => {
      const doc1 = buildProtocolPdf(fixture_we0_dressuur.protocol, fixture_we0_dressuur.items);
      const doc2 = buildProtocolPdf(fixture_we1_stijl.protocol, fixture_we1_stijl.items);
      
      const output1 = doc1.output('datauristring');
      const output2 = doc2.output('datauristring');
      
      expect(output1).not.toBe(output2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid protocol gracefully', () => {
      expect(() => {
        buildProtocolPdf({}, []);
      }).not.toThrow();
    });

    it('should handle null items gracefully', () => {
      const { protocol } = fixture_we0_dressuur;
      expect(() => {
        buildProtocolPdf(protocol, null);
      }).toThrow();
    });
  });
});

describe('PDF Snapshot Tests', () => {
  it('WE0 dressuur PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_we0_dressuur;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('we0-dressuur-pages');
  });

  it('WE1 stijl PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_we1_stijl;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('we1-stijl-pages');
  });

  it('WE2 speed PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_we2_speed;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('we2-speed-pages');
  });

  it('WE3 dressuur PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_we3_dressuur;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('we3-dressuur-pages');
  });

  it('Jeugd WE1 stijl PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_jeugd_we1_stijl;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('jeugd-we1-stijl-pages');
  });

  it('WE2+ dressuur PDF structure should match snapshot', () => {
    const { protocol, items } = fixture_we2plus_dressuur;
    const doc = buildProtocolPdf(protocol, items);
    const pageCount = doc.internal.pages.length;
    
    expect(pageCount).toMatchSnapshot('we2plus-dressuur-pages');
  });
});
