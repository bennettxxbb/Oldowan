import { Component, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DrugTraceabilityCodeConversionService } from './drug-traceability-code-conversion.service';
import { DEFAULT_ACTOR, DEFAULT_TO_CORP_ID } from './constants';

@Component({
  selector: 'app-drug-traceability-code-conversion',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
  ],
  templateUrl: './drug-traceability-code-conversion.html',
  styleUrl: './drug-traceability-code-conversion.scss',
  providers: [provideNativeDateAdapter()],
})
export class DrugTraceabilityCodeConversion {
  private readonly service = inject(DrugTraceabilityCodeConversionService);

  protected readonly actor = signal(DEFAULT_ACTOR);
  protected readonly actDate = signal<Date>(new Date());
  protected readonly actTime = signal('12:00:00');
  protected readonly toCorpID = signal(DEFAULT_TO_CORP_ID);
  protected readonly corpOrderID = signal('');

  protected readonly selectedFileName = signal('');
  protected readonly parsedCodes = signal<string[]>([]);
  protected readonly generatedXml = signal('');

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
}
