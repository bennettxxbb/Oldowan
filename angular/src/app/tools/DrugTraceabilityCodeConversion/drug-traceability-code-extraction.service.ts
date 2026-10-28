import { Injectable } from '@angular/core';
import { writeXlsx } from 'hucre';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** A file that could not be read or contained no usable traceability codes. */
export interface ExtractionFailure {
  fileName: string;
  reason: string;
}

export interface ExtractionResult {
  /** Codes in file order; duplicates across files are preserved. */
  codes: string[];
  failures: ExtractionFailure[];
  /** Number of files parsed successfully. */
  successCount: number;
  /** Number of files submitted for extraction. */
  fileCount: number;
}

export type ExtractionProgressCallback = (processed: number, total: number) => void;

@Injectable({ providedIn: 'root' })
export class DrugTraceabilityCodeExtractionService {
  /**
   * Extract every Code attribute of every Data node from a batch of XML
   * files. A file that cannot be read or parsed is reported in `failures`
   * and does not stop the remaining files from being processed.
   */
  async extract(files: File[], onProgress?: ExtractionProgressCallback): Promise<ExtractionResult> {
    const codes: string[] = [];
    const failures: ExtractionFailure[] = [];
    let successCount = 0;

    for (const [index, file] of files.entries()) {
      let content: string;
      try {
        content = await file.text();
      } catch (error) {
        failures.push({
          fileName: file.name,
          reason: `无法读取文件：${errorMessage(error)}`,
        });
        onProgress?.(index + 1, files.length);
        continue;
      }

      try {
        for (const code of extractCodes(content)) {
          codes.push(code);
        }
        successCount++;
      } catch (error) {
        failures.push({
          fileName: file.name,
          reason: errorMessage(error),
        });
      }

      onProgress?.(index + 1, files.length);
    }

    return { codes, failures, successCount, fileCount: files.length };
  }

  /**
   * Build a one-column workbook of codes with no header row. This is exactly
   * the format the conversion tool's Excel parser expects.
   */
  async buildXlsx(codes: string[]): Promise<Blob> {
    const data = await writeXlsx({
      sheets: [{ name: '追溯码', rows: codes.map((code) => [code]) }],
    });

    // Copy into a fresh Uint8Array so the blob part is backed by a plain ArrayBuffer.
    return new Blob([new Uint8Array(data)], { type: XLSX_MIME });
  }
}

/**
 * Parse one XML document and return every Data node's Code value.
 * Throws with a user-facing reason when the file is not a valid
 * traceability XML document.
 */
function extractCodes(content: string): string[] {
  const text = content.replace(/^\uFEFF/, '');
  if (text.trim().length === 0) {
    throw new Error('文件内容为空');
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML 解析失败：${formatParserError(parserError.textContent ?? '')}`);
  }
  if (!doc.documentElement) {
    throw new Error('XML 解析失败：无法读取文档结构');
  }

  // The wildcard namespace also matches Data nodes in documents that
  // declare a default or prefixed namespace.
  const dataNodes = doc.getElementsByTagNameNS('*', 'Data');
  if (dataNodes.length === 0) {
    throw new Error('未找到 Data 节点');
  }

  const codes: string[] = [];
  for (let i = 0; i < dataNodes.length; i++) {
    const code = dataNodes[i].getAttribute('Code')?.trim();
    if (!code) {
      throw new Error(`第 ${i + 1} 个 Data 节点缺少 Code 属性`);
    }
    codes.push(code);
  }

  return codes;
}

/** Turn a browser parsererror message into a short, readable reason. */
function formatParserError(raw: string): string {
  const text = raw
    .replace(/\s+/g, ' ')
    .replace(/^This page contains the following errors:\s*/i, '')
    .replace(/\s*Below is a rendering of the page up to the first error\.?\s*$/i, '')
    .trim();

  const match = /error on line (\d+)(?: at column (\d+))?:\s*(.*)/i.exec(text);
  if (match) {
    const [, line, column, message] = match;
    const position = column ? `第 ${line} 行第 ${column} 列` : `第 ${line} 行`;
    return `${position}：${message.trim()}`;
  }

  // Other engines (e.g. jsdom) report "line:column: message".
  const shortForm = /^(\d+):(\d+):\s*(.*)$/.exec(text);
  if (shortForm) {
    return `第 ${shortForm[1]} 行第 ${shortForm[2]} 列：${shortForm[3].trim()}`;
  }

  return text;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
