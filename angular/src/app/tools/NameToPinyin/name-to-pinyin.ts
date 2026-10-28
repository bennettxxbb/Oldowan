import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { NameToPinyinService, NamePinyinRow } from './name-to-pinyin.service';

const PREVIEW_LIMIT = 200;

@Component({
  selector: 'app-name-to-pinyin',
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './name-to-pinyin.html',
  styleUrl: './name-to-pinyin.scss',
})
export class NameToPinyin {
  private readonly service = inject(NameToPinyinService);

  protected readonly previewLimit = PREVIEW_LIMIT;
  protected readonly selectedFileName = signal('');
  protected readonly rows = signal<NamePinyinRow[]>([]);
  protected readonly previewRows = computed(() =>
    this.rows().slice(0, PREVIEW_LIMIT),
  );
  protected readonly hasFlaggedRows = computed(() =>
    this.rows().some((row) => row.reviewReasons.length > 0),
  );

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.selectedFileName.set(file.name);
    this.service
      .parseNames(file)
      .then((names) => this.rows.set(this.service.convert(names)))
      .catch(() => this.clearFile());
  }

  async downloadXlsx(): Promise<void> {
    const rows = this.rows();
    if (rows.length === 0) return;

    const blob = await this.service.buildXlsx(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '姓名拼音.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  clearFile(): void {
    this.selectedFileName.set('');
    this.rows.set([]);
  }
}
