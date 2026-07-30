import { Routes } from '@angular/router';
import { DrugTraceabilityCodeConversion } from './tools/DrugTraceabilityCodeConversion/drug-traceability-code-conversion';

export const routes: Routes = [
  { path: '', redirectTo: '/DrugTraceabilityCodeConversion', pathMatch: 'full' },
  { path: 'DrugTraceabilityCodeConversion', component: DrugTraceabilityCodeConversion },
];
