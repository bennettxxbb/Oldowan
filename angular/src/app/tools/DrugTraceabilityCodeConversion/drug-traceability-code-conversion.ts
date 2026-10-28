import { Component, computed, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DrugTraceabilityCodeConversionService } from './drug-traceability-code-conversion.service';
import {
  DrugTraceabilityCodeExtractionService,
  ExtractionResult,
} from './drug-traceability-code-extraction.service';
import { DEFAULT_ACTOR, DEFAULT_TO_CORP_ID } from './constants';

const EXTRACTION_PREVIEW_LIMIT = 100;

@Component({
  selector: 'app-drug-traceability-code-conversion',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './drug-traceability-code-conversion.html',
  styleUrl: './drug-traceability-code-conversion.scss',
  providers: [provideNativeDateAdapter()],
})
export class DrugTraceabilityCodeConversion {
  private readonly service = inject(DrugTraceabilityCodeConversionService);
  private readonly extractionService = inject(DrugTraceabilityCodeExtractionService);

  protected readonly actor = signal(DEFAULT_ACTOR);
  protected readonly actDate = signal<Date>(new Date());
  protected readonly actTime = signal('12:00:00');
  protected readonly toCorpID = signal(DEFAULT_TO_CORP_ID);
  protected readonly corpOrderID = signal('');

  protected readonly selectedFileName = signal('');
  protected readonly parsedCodes = signal<string[]>([]);
  protected readonly generatedXml = signal('');

  protected readonly extractionPreviewLimit = EXTRACTION_PREVIEW_LIMIT;
  protected readonly extracting = signal(false);
  protected readonly extractionProcessed = signal(0);
  protected readonly extractionTotal = signal(0);
  protected readonly extractionResult = signal<ExtractionResult | null>(null);
  protected readonly extractedPreview = computed(
    () => this.extractionResult()?.codes.slice(0, EXTRACTION_PREVIEW_LIMIT) ?? [],
  );
  protected readonly extractionPercent = computed(() => {
    const total = this.extractionTotal();
    return total === 0 ? 0 : (this.extractionProcessed() / total) * 100;
  });

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedFileName.set(file.name);
    this.service
      .parseExcel(file)
      .then((codes) => this.parsedCodes.set(codes))
      .catch(() => {
        this.selectedFileName.set('');
        this.parsedCodes.set([]);
      });
  }

  generateXml(): void {
    const codes = this.parsedCodes();
    if (codes.length === 0) return;

    const date = this.actDate();
    const datePart = formatDate(date, 'yyyy-MM-dd', 'en-US');
    const actDateStr = `${datePart} ${this.actTime()}`;

    const xml = this.service.generateXml(codes, {
      actor: this.actor(),
      actDate: actDateStr,
      toCorpID: this.toCorpID(),
      corpOrderID: this.corpOrderID(),
    });
    this.generatedXml.set(xml);
  }

  downloadXml(): void {
    const xml = this.generatedXml();
    if (!xml) return;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.xml';
    a.click();
    URL.revokeObjectURL(url);
  }

  clearFile(): void {
    this.selectedFileName.set('');
    this.parsedCodes.set([]);
    this.generatedXml.set('');
  }

  async onXmlFilesChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Reset so the same files can be selected again.
    input.value = '';
    if (files.length === 0 || this.extracting()) return;

    this.extracting.set(true);
    this.extractionProcessed.set(0);
    this.extractionTotal.set(files.length);
    this.extractionResult.set(null);

    try {
      const result = await this.extractionService.extract(files, (processed) =>
        this.extractionProcessed.set(processed),
      );
      this.extractionResult.set(result);
    } finally {
      this.extracting.set(false);
    }
  }

  async downloadExtractedXlsx(): Promise<void> {
    const result = this.extractionResult();
    if (!result || result.codes.length === 0) return;

    const blob = await this.extractionService.buildXlsx(result.codes);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '药品追溯码.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  clearExtraction(): void {
    if (this.extracting()) return;
    this.extractionResult.set(null);
    this.extractionProcessed.set(0);
    this.extractionTotal.set(0);
  }
}
