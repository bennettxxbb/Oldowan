import { Injectable } from '@angular/core';
import { readXlsx } from 'hucre';
import { XML_HEADER, XML_FOOTER, buildDataField } from './constants';

export interface XmlMetadata {
  actor: string;
  actDate: string;
  toCorpID: string;
  corpOrderID: string;
}

@Injectable({ providedIn: 'root' })
export class DrugTraceabilityCodeConversionService {
  /**
   * Parse an Excel file and extract drug traceability codes from the first column.
   * Deduplicates codes using Set.
   */
  async parseExcel(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const workbook = await readXlsx(new Uint8Array(buffer));
    const firstSheet = workbook.sheets[0];
    const data = firstSheet.rows;

    const codes = data
      .map((row) => (row[0] != null ? String(row[0]).trim() : ''))
      .filter((code) => code.length > 0);

    // Deduplicate using Set — first occurrence wins for each unique code
    return [...new Set(codes)];
  }

  /**
   * Generate XML string from drug traceability codes and metadata.
   */
  generateXml(codes: string[], metadata: XmlMetadata): string {
    const dataFields = codes
      .map((code) =>
        buildDataField(code, metadata.actor, metadata.actDate, metadata.toCorpID, metadata.corpOrderID),
      )
      .join('\n');

    return XML_HEADER + '\n' + dataFields + '\n' + XML_FOOTER;
  }
}
