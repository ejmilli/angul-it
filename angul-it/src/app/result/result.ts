import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CaptchaState } from '../services/captcha-state';

interface ChallengeResult {
  stage: number;
  instruction: string;
  status: 'success';
}

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result.html',
  styleUrl: './result.css'
})
export class ResultComponent implements OnInit, OnDestroy {
  results: ChallengeResult[] = [];
  totalStages = 3;
  completedStages = 0;
  completionTime: number | null = null; // To store completion time in seconds

  constructor(
    private router: Router,
    private stateService: CaptchaState
  ) {}

  ngOnInit() {
    const progress = this.stateService.loadProgress();
    // Double-check guard logic here. If not fully complete, redirect.
    if (!progress || progress.completedStages?.length < this.totalStages) {
      this.router.navigate(['/captcha']);
      return; // Stop further execution
    }
    
    this.loadResults();
  }

  // Clear progress when leaving results page
  ngOnDestroy() {
    console.log('ResultComponent: Destroyed. Clearing progress.');
    this.stateService.clearProgress();
  }

  private loadResults() {
    const progress = this.stateService.loadProgress();
    
    // This check is now safer because of the ngOnInit guard
    if (progress) {
      // Calculate completion time
      if (progress.startTime && progress.endTime) {
        this.completionTime = (progress.endTime - progress.startTime) / 1000;
      }

      const instructions = progress.challengeInstructions || [];
      const completedStages = progress.completedStages || [];
      
      this.completedStages = completedStages.length;
      
      this.results = completedStages.map(stageNum => ({
        stage: stageNum,
        instruction: instructions[stageNum - 1] || `Challenge ${stageNum}`,
        status: 'success' as const
      }));
      
      this.results.sort((a, b) => a.stage - b.stage);
    }
  }


  startNewChallenge() {
    // Clear all saved progress
    this.stateService.clearProgress();
    
    // Navigate to captcha page
    this.router.navigate(['/captcha']);
  }

  goHome() {
    // Clear progress before going home
    this.stateService.clearProgress();
    this.router.navigate(['/']);
  }

get completionMessage(): string {
  if (this.completedStages >= this.totalStages) {
    return "🎉 Congratulations! You have successfully proven you are not a bot!";
  } else if (this.completedStages >= 2) {
    return "👏 Great progress! Complete all challenges to prove you're not a bot!";
  } else if (this.completedStages >= 1) {
    return "👍 Good start! Continue the challenges to verify you're human!";
  } else {
    return "🤔 Please complete the challenges to prove you're not a bot!";
  }
}


  get performanceRating(): string {
    if (this.completedStages < this.totalStages) {
      return "Needs Improvement";
    }

    if (this.completionTime === null) {
      return "Excellent"; // Fallback if time isn't available
    }

    // Time-based rating
    if (this.completionTime <= 15) return "⚡ Lightning Fast!";
    if (this.completionTime <= 30) return "Excellent";
    if (this.completionTime <= 60) return "Good";
    return "Completed";
  }
}
