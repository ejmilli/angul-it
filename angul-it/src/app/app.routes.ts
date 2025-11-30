import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { CaptchaComponent } from './captcha/captcha';
import { ResultComponent } from './result/result';
import { resultGuard } from './guards/result-guard-guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'captcha', component: CaptchaComponent },
  { 
    path: 'result', 
    component: ResultComponent,
    canActivate: [resultGuard]  // Protect results page
  },
  { path: '**', redirectTo: '' }  // Redirect unknown routes to home
];
