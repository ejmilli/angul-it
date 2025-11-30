import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CaptchaState } from '../services/captcha-state';

export const resultGuard: CanActivateFn = (route, state) => {
  const stateService = inject(CaptchaState);
  const router = inject(Router);
  
  // Check if user has successfully completed all challenges
  const progress = stateService.loadProgress();
  
  console.log('Result Guard - Checking access. Progress:', progress);
  
  // STRICT CHECK: Must have valid progress AND all 3 stages completed
  if (progress && 
      progress.completedStages && 
      progress.completedStages.length === 3) {
    console.log('✅ Access granted to results page - All 3 stages completed');
    return true;
  }
  
  // Block access - No valid completion
  console.log('❌ Access DENIED to results - Redirecting to captcha');
  console.log('Completed stages:', progress?.completedStages?.length || 0);
  router.navigate(['/captcha']);
  return false;
};
