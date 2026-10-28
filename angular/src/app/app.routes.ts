import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/DrugTraceabilityCodeConversion', pathMatch: 'full' },
  {
    path: 'DrugTraceabilityCodeConversion',
    loadComponent: () =>
      import('./tools/DrugTraceabilityCodeConversion/drug-traceability-code-conversion').then(
        (m) => m.DrugTraceabilityCodeConversion,
      ),
  },
  {
    path: 'NameToPinyin',
    loadComponent: () =>
      import('./tools/NameToPinyin/name-to-pinyin').then((m) => m.NameToPinyin),
  },
];
