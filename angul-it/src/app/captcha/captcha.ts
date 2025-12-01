import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CaptchaState } from '../services/captcha-state';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
// one image data
interface ChallengeImage {
  src: string;  // The actual image data in base64
  alt: string; //equation or text description
}
//one complete stage data
interface Challenge {
  instruction: string;
  images: ChallengeImage[];
  correctCategory: string;
  correctAnswers: number[];
  type?: 'selection' | 'text-input'; // Challenge type
  textAnswer?: string; // For text input challenges
}

@Component({
  selector: 'app-captcha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './captcha.html',
  styleUrl: './captcha.css'
})
export class CaptchaComponent implements OnInit, OnDestroy {
  currentStage = 1;
  totalStages = 3;
  selectedImages: number[] = [];
  completedStages: number[] = []; // Successfully completed stages
  
  showValidation = false;
  validationMessage = '';
  isCorrect = false;
  isTransitioning = false; // Prevent multiple clicks during transition
  
  showRestorePrompt = false;
  hasCompletedAllStages = false; // Track if user completed all stages

  challenges: Challenge[] = [];
  
  private usedChallengeCategories: Set<string> = new Set();

  // Text input related
  userTextInput = '';

  constructor(
    private router: Router,
    private stateService: CaptchaState,
    private sanitizer: DomSanitizer,
    private ngZone: NgZone
  ) {}

  // SSR-safe base64 encoding
  private encodeBase64(str: string): string {
    if (typeof window !== 'undefined' && typeof btoa === 'function') {
      return btoa(str);
    } else {
      return Buffer.from(str).toString('base64');
    }
  }

  // Escape XML special characters for SVG
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
// fisher-yates shuffle
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const randomValue = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF
        : Math.random();
      const j = Math.floor(randomValue * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateCaptchaChallenges(): Challenge[] {
    type ChallengeData = {
      instruction: string;
      correctCategory: string;
    } & (
      { type: 'math'; equations: { equation: string; result: number; isCorrect: boolean }[] } |
      { type: 'text'; texts: { text: string; isCorrect: boolean }[] } |
      { type: 'text-input'; displayText: string; answer: string; }
    );

    const allChallenges: ChallengeData[] = [
      {
        type: 'math',
        instruction: "Select all images where the MATH RESULT equals 15",
        correctCategory: "math15",
        equations: [
          { equation: "7 + 8", result: 15, isCorrect: true },
          { equation: "6 + 9", result: 15, isCorrect: true },
          { equation: "10 + 5", result: 15, isCorrect: true },
          { equation: "7 + 6", result: 13, isCorrect: false },
          { equation: "9 + 4", result: 13, isCorrect: false },
          { equation: "5 + 8", result: 13, isCorrect: false },
          { equation: "4 + 7", result: 11, isCorrect: false },
          { equation: "3 + 9", result: 12, isCorrect: false },
          { equation: "11 + 2", result: 13, isCorrect: false }
        ]
      },
      {
        type: 'text',
        instruction: "Select all images containing the word 'VERIFY'",
        correctCategory: "verify",
        texts: [
          { text: "VERIFY", isCorrect: true },
          { text: "VERIFY", isCorrect: true },
          { text: "VERIFY", isCorrect: true },
          { text: "SECURE", isCorrect: false },
          { text: "ACCESS", isCorrect: false },
          { text: "CAPTCHA", isCorrect: false },
          { text: "LOGIN", isCorrect: false },
          { text: "ROBOT", isCorrect: false },
          { text: "DENIED", isCorrect: false }
        ]
      },
      {
        type: 'text-input',
        instruction: "Type the word you see below",
        correctCategory: "input-verify",
        displayText: "VERIFY",
        answer: "VERIFY"
      },
      {
        type: 'math',
        instruction: "Select all images where the SUM is GREATER than 20",
        correctCategory: "sum20",
        equations: [
          { equation: "15 + 8", result: 23, isCorrect: true },
          { equation: "12 + 11", result: 23, isCorrect: true },
          { equation: "14 + 9", result: 23, isCorrect: true },
          { equation: "8 + 9", result: 17, isCorrect: false },
          { equation: "7 + 11", result: 18, isCorrect: false },
          { equation: "6 + 12", result: 18, isCorrect: false },
          { equation: "9 + 10", result: 19, isCorrect: false },
          { equation: "7 + 8", result: 15, isCorrect: false },
          { equation: "10 + 9", result: 19, isCorrect: false }
        ]
      },
      {
        type: 'text',
        instruction: "Select all images containing the word 'HUMAN'",
        correctCategory: "human",
        texts: [
          { text: "HUMAN", isCorrect: true },
          { text: "HUMAN", isCorrect: true },
          { text: "HUMAN", isCorrect: true },
          { text: "ROBOT", isCorrect: false },
          { text: "MACHINE", isCorrect: false },
          { text: "BOT", isCorrect: false },
          { text: "AUTO", isCorrect: false },
          { text: "SCRIPT", isCorrect: false },
          { text: "SYSTEM", isCorrect: false }
        ]
      },
      {
        type: 'text-input',
        instruction: "Solve the equation and enter the answer",
        correctCategory: "input-math15",
        displayText: "8 + 7 = ?",
        answer: "15"
      },
      {
        type: 'math',
        instruction: "Select all images where RESULT equals 12",
        correctCategory: "math12",
        equations: [
          { equation: "5 + 7", result: 12, isCorrect: true },
          { equation: "9 + 3", result: 12, isCorrect: true },
          { equation: "6 + 6", result: 12, isCorrect: true },
          { equation: "8 + 6", result: 14, isCorrect: false },
          { equation: "4 + 9", result: 13, isCorrect: false },
          { equation: "7 + 7", result: 14, isCorrect: false },
          { equation: "10 + 5", result: 15, isCorrect: false },
          { equation: "8 + 5", result: 13, isCorrect: false },
          { equation: "11 + 3", result: 14, isCorrect: false }
        ]
      },
      {
        type: 'text',
        instruction: "Select all images containing the word 'SECURE'",
        correctCategory: "secure",
        texts: [
          { text: "SECURE", isCorrect: true },
          { text: "SECURE", isCorrect: true },
          { text: "SECURE", isCorrect: true },
          { text: "UNSAFE", isCorrect: false },
          { text: "DANGER", isCorrect: false },
          { text: "OPEN", isCorrect: false },
          { text: "BROKEN", isCorrect: false },
          { text: "FAIL", isCorrect: false },
          { text: "RISK", isCorrect: false }
        ]
      },
      {
        type: 'text-input',
        instruction: "Type the security code shown below",
        correctCategory: "input-code",
        displayText: "A7X9K2",
        answer: "A7X9K2"
      },
      {
        type: 'math',
        instruction: "Select all images where RESULT is LESS than 10",
        correctCategory: "mathless10",
        equations: [
          { equation: "3 + 4", result: 7, isCorrect: true },
          { equation: "2 + 5", result: 7, isCorrect: true },
          { equation: "4 + 4", result: 8, isCorrect: true },
          { equation: "5 + 6", result: 11, isCorrect: false },
          { equation: "8 + 3", result: 11, isCorrect: false },
          { equation: "6 + 7", result: 13, isCorrect: false },
          { equation: "9 + 2", result: 11, isCorrect: false },
          { equation: "7 + 5", result: 12, isCorrect: false },
          { equation: "10 + 3", result: 13, isCorrect: false }
        ]
      },
      {
        type: 'text',
        instruction: "Select all images containing the word 'ACCESS'",
        correctCategory: "access",
        texts: [
          { text: "ACCESS", isCorrect: true },
          { text: "ACCESS", isCorrect: true },
          { text: "ACCESS", isCorrect: true },
          { text: "DENIED", isCorrect: false },
          { text: "BLOCKED", isCorrect: false },
          { text: "CLOSED", isCorrect: false },
          { text: "REJECT", isCorrect: false },
          { text: "STOP", isCorrect: false },
          { text: "ERROR", isCorrect: false }
        ]
      },
      {
        type: 'math',
        instruction: "Select all images where RESULT equals 18",
        correctCategory: "math18",
        equations: [
          { equation: "9 + 9", result: 18, isCorrect: true },
          { equation: "10 + 8", result: 18, isCorrect: true },
          { equation: "12 + 6", result: 18, isCorrect: true },
          { equation: "7 + 8", result: 15, isCorrect: false },
          { equation: "6 + 11", result: 17, isCorrect: false },
          { equation: "5 + 9", result: 14, isCorrect: false },
          { equation: "11 + 4", result: 15, isCorrect: false },
          { equation: "13 + 3", result: 16, isCorrect: false },
          { equation: "14 + 2", result: 16, isCorrect: false }
        ]
      },
      {
        type: 'text',
        instruction: "Select all images containing the word 'VALID'",
        correctCategory: "valid",
        texts: [
          { text: "VALID", isCorrect: true },
          { text: "VALID", isCorrect: true },
          { text: "VALID", isCorrect: true },
          { text: "INVALID", isCorrect: false },
          { text: "FALSE", isCorrect: false },
          { text: "WRONG", isCorrect: false },
          { text: "ERROR", isCorrect: false },
          { text: "FAIL", isCorrect: false },
          { text: "BAD", isCorrect: false }
        ]
      },
      {
        type: 'text-input',
        instruction: "Enter the shown verification code",
        correctCategory: "input-code2",
        displayText: "XK94P",
        answer: "XK94P"
      }
    ];

    const availableChallenges = allChallenges.filter(
      challenge => !this.usedChallengeCategories.has(challenge.correctCategory)
    );

    if (availableChallenges.length < 3) {
      this.usedChallengeCategories.clear();
      return this.generateCaptchaChallenges();
    }

    const shuffledChallenges = this.shuffleArray(availableChallenges);
    const selectedChallenges = shuffledChallenges.slice(0, 3);

    selectedChallenges.forEach(challenge => {
      this.usedChallengeCategories.add(challenge.correctCategory);
    });

    console.log('Generated challenges:', selectedChallenges.map(c => ({ type: c.type, category: c.correctCategory })));

    return selectedChallenges.map(challenge => {
      let imagesData: ChallengeImage[];
      let correctIndices: number[] = [];

      if (challenge.type === 'text-input') {
        // Text input challenge - create single display image
        // Use appropriate captcha generator based on content
        const isMathChallenge = challenge.displayText.match(/[+\-×÷=\d]/);
        const imageSrc = isMathChallenge 
          ? this.createNoisyMathCaptcha(challenge.displayText)
          : this.createNoisyTextCaptcha(challenge.displayText);
          
        return {
          instruction: challenge.instruction,
          images: [{
            src: imageSrc,
            alt: `Text: ${challenge.displayText}`
          }],
          correctCategory: challenge.correctCategory,
          correctAnswers: [],
          type: 'text-input' as const,
          textAnswer: challenge.answer
        };
      } else if (challenge.type === 'math') {
        const shuffledEquations = this.shuffleArray(challenge.equations);
        
        imagesData = shuffledEquations.map((eq, idx) => {
          if (eq.isCorrect) correctIndices.push(idx);
          return {
            src: this.createNoisyMathCaptcha(eq.equation),
            alt: `Math: ${eq.equation}`,
            category: eq.isCorrect ? 'correct' : 'incorrect'
          };
        });
      } else {
        const shuffledTexts = this.shuffleArray(challenge.texts);
        
        imagesData = shuffledTexts.map((t, idx) => {
          if (t.isCorrect) correctIndices.push(idx);
          return {
            src: this.createNoisyTextCaptcha(t.text),
            alt: `Text: ${t.text}`,
            category: t.isCorrect ? challenge.correctCategory : 'other'
          };
        });
      }

      return {
        instruction: challenge.instruction,
        images: imagesData,
        correctCategory: challenge.correctCategory,
        correctAnswers: correctIndices,
        type: 'selection' as const
      };
    });
  }

private createNoisyMathCaptcha(equation: string, seed: number = Date.now()): string {
  const randomId = (seed + Math.random()).toString(36).substring(7);
  const svg = `
    <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="noise${randomId}">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="5" />
          <feColorMatrix type="saturate" values="0"/>
          <feBlend mode="multiply"/>
        </filter>
        <filter id="blur${randomId}">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8"/>
        </filter>
        <filter id="distort${randomId}">
          <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
          <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="3" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      
      <rect width="200" height="80" fill="#e8e8e8"/>
      <rect width="200" height="80" fill="url(#noise${randomId})" opacity="0.25"/>
      
      ${Array.from({length: 40}, () => {
        const x1 = Math.random() * 200;
        const y1 = Math.random() * 80;
        const x2 = Math.random() * 200;
        const y2 = Math.random() * 80;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#${Math.random() > 0.5 ? '999' : '666'}" stroke-width="${1 + Math.random()}" opacity="${0.4 + Math.random() * 0.3}"/>`;
      }).join('')}
      
      ${Array.from({length: 120}, () => {
        const cx = Math.random() * 200;
        const cy = Math.random() * 80;
        const r = Math.random() * 2.5;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#${Math.random() > 0.5 ? '444' : '888'}" opacity="${0.3 + Math.random() * 0.4}"/>`;
      }).join('')}
      
      ${Array.from({length: 3}, (_, i) => {
        const y = 20 + i * 20;
        return `<path d="M 0 ${y} Q 50 ${y - 10 + Math.random() * 20} 100 ${y} T 200 ${y}" stroke="#aaa" stroke-width="1.5" fill="none" opacity="0.5"/>`;
      }).join('')}
      
      <text x="100" y="48" font-family="Arial, sans-serif" font-size="28" 
            font-weight="900" fill="#1a1a1a" text-anchor="middle"
            filter="url(#blur${randomId}) url(#distort${randomId})"
            transform="rotate(${-8 + Math.random() * 16} 100 40)"
            letter-spacing="${-1 + Math.random() * 2}">
        ${this.escapeXml(equation)}
      </text>
      
      <rect width="200" height="80" fill="white" opacity="0.1"/>
    </svg>
  `;
  return 'data:image/svg+xml;base64,' + this.encodeBase64(svg);
}

private createNoisyTextCaptcha(text: string, seed: number = Date.now()): string {
  const randomId = (seed + Math.random()).toString(36).substring(7);
  const svg = `
    <svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="noise${randomId}">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4" />
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <filter id="blur${randomId}">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.0"/>
        </filter>
        <filter id="wave${randomId}">
          <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="3" result="turbulence"/>
          <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      
      <rect width="200" height="80" fill="#f0f0f0"/>
      <rect width="200" height="80" fill="url(#noise${randomId})" opacity="0.3"/>
      
      ${Array.from({length: 35}, () => {
        const x1 = Math.random() * 200;
        const y1 = Math.random() * 80;
        const x2 = Math.random() * 200;
        const y2 = Math.random() * 80;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#${Math.random() > 0.5 ? 'aaa' : '777'}" stroke-width="${1.5 + Math.random()}" opacity="${0.4 + Math.random() * 0.3}"/>`;
      }).join('')}
      
      ${Array.from({length: 150}, () => {
        const cx = Math.random() * 200;
        const cy = Math.random() * 80;
        const r = Math.random() * 2;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#${Math.random() > 0.5 ? '555' : '999'}" opacity="${0.35 + Math.random() * 0.35}"/>`;
      }).join('')}
      
      ${Array.from({length: 4}, (_, i) => {
        const y = 15 + i * 18;
        return `<path d="M 0 ${y} Q 50 ${y + Math.random() * 15 - 7.5} 100 ${y} T 200 ${y}" stroke="#bbb" stroke-width="2" fill="none" opacity="0.45"/>`;
      }).join('')}
      
      <text x="100" y="48" font-family="Courier New, monospace" font-size="24" 
            font-weight="900" fill="#0a0a0a" text-anchor="middle"
            filter="url(#blur${randomId}) url(#wave${randomId})"
            transform="rotate(${-6 + Math.random() * 12} 100 40) skewX(${-3 + Math.random() * 6})"
            letter-spacing="${0.5 + Math.random() * 2}">
        ${this.escapeXml(text)}
      </text>
      
      ${Array.from({length: 2}, () => {
        const y = 30 + Math.random() * 20;
        return `<line x1="40" y1="${y}" x2="160" y2="${y + Math.random() * 10 - 5}" stroke="#ccc" stroke-width="1.5" opacity="0.6"/>`;
      }).join('')}
      
      <rect width="200" height="80" fill="white" opacity="0.12"/>
    </svg>
  `;
  return 'data:image/svg+xml;base64,' + this.encodeBase64(svg);
}








  getSafeImage(src: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  }

  ngOnInit() {
    this.checkForSavedProgress();
    this.resetValidation();
    
    // Only initialize if there's no progress at all.
    // This prevents re-initialization when navigating back from the results page.
    if (!this.stateService.hasSavedProgress()) {
      console.log('No saved progress - starting fresh with new challenges');
      this.usedChallengeCategories.clear();
      this.challenges = this.generateCaptchaChallenges();
      this.stateService.initializeProgress();
      this.saveCurrentProgress();
    } else {
      const progress = this.stateService.loadProgress();
      if (progress && progress.completedStages.length < 3) {
        // There's partial progress, so we'll show the restore prompt
        console.log('Found saved progress');
      }
    }
    
    setTimeout(() => this.handleCompletedUser(), 100);
  }

  private saveCurrentProgress() {
    const challengeInstructions = this.challenges.map(c => c.instruction);
    const usedCategories = Array.from(this.usedChallengeCategories);
    this.stateService.saveProgress(
      this.currentStage,
      this.selectedImages,
      this.completedStages,
      undefined,
      challengeInstructions,
      undefined,
      this.challenges,
      usedCategories
    );
  }

  ngOnDestroy() {
    // DO NOT save progress on destroy. This was causing a race condition
    // where incomplete state was saved after progress was cleared.
  }

  private checkForSavedProgress() {
    if (this.stateService.hasSavedProgress()) {
      const savedProgress = this.stateService.loadProgress();
      
      // Check if all stages are completed
      if (savedProgress && savedProgress.completedStages.length >= this.totalStages) {
        this.hasCompletedAllStages = true;
      } else {
        this.hasCompletedAllStages = false;
      }
      
      this.showRestorePrompt = true;
    }
  }

  restoreProgress() {
    const savedProgress = this.stateService.loadProgress();
    if (savedProgress) {
      this.currentStage = savedProgress.currentStage;
      this.selectedImages = [...savedProgress.selectedImages];
      this.completedStages = [...savedProgress.completedStages];
      
      // Restore the actual challenge data and used categories
      if (savedProgress.challenges && savedProgress.challenges.length > 0) {
        this.challenges = savedProgress.challenges;
        console.log('Restored saved challenges');
      } else {
        // Fallback: generate new challenges if none saved
        this.usedChallengeCategories.clear();
        this.challenges = this.generateCaptchaChallenges();
        console.log('No saved challenges found, generating new ones');
      }
      
      if (savedProgress.usedCategories) {
        this.usedChallengeCategories = new Set(savedProgress.usedCategories);
      }
    }
    this.showRestorePrompt = false;
  }

  startFresh() {
    this.stateService.clearProgress();
    this.showRestorePrompt = false;
    this.resetToInitialState();
    this.usedChallengeCategories.clear();
    this.challenges = this.generateCaptchaChallenges();
  }

  get currentChallenge(): Challenge {
    const challenge = this.challenges[this.currentStage - 1];
    // Ensure type is set for backward compatibility
    if (!challenge.type) {
      challenge.type = 'selection';
    }
    console.log('Current challenge type:', challenge.type, 'Stage:', this.currentStage);
    return challenge;
  }

  isTextInputChallenge(): boolean {
    return this.currentChallenge?.type === 'text-input';
  }

  toggleImageSelection(index: number) {
    if (this.showValidation && this.isCorrect) return;
    if (this.currentChallenge.type === 'text-input') return; // No selection for text input

    const selectedIndex = this.selectedImages.indexOf(index);
    if (selectedIndex > -1) {
      this.selectedImages.splice(selectedIndex, 1);
    } else {
      this.selectedImages.push(index);
    }
    
    if (this.showValidation) {
      this.resetValidation();
    }
    
    this.saveCurrentProgress();
  }

  validateSelection(): boolean {
    const challenge = this.currentChallenge;
    
    // Text input validation - case sensitive
    if (challenge.type === 'text-input') {
      return this.userTextInput.trim() === challenge.textAnswer;
    }
    
    // Image selection validation
    const correctAnswers = challenge.correctAnswers;
    const selectedImages = this.selectedImages;
    
    const selectedSet = new Set(selectedImages);
    const correctSet = new Set(correctAnswers);
    
    if (selectedSet.size !== correctSet.size) {
      return false;
    }
    
    return [...correctSet].every(answer => selectedSet.has(answer));
  }

  nextStage() {
    const isTextInput = this.currentChallenge.type === 'text-input';
    
    if (!isTextInput && this.selectedImages.length === 0) {
      this.showValidationMessage('Please select at least one image before proceeding.', false);
      return;
    }
    
    if (isTextInput && !this.userTextInput.trim()) {
      this.showValidationMessage('Please enter your answer before proceeding.', false);
      return;
    }

    const isValid = this.validateSelection();
    console.log('Validation result:', isValid);
    if (!isTextInput) {
      console.log('Selected images:', this.selectedImages);
      console.log('Correct answers:', this.currentChallenge.correctAnswers);
    } else {
      console.log('User input:', this.userTextInput);
      console.log('Correct answer:', this.currentChallenge.textAnswer);
    }

    if (isValid) {
      console.log('SUCCESS - Moving to next stage');
      // SUCCESS - Add to completed stages and move forward
      if (!this.completedStages.includes(this.currentStage)) {
        this.completedStages.push(this.currentStage);
      }
      
      this.showValidationMessage('✅ Correct! Moving to next stage...', true);
      this.saveCurrentProgress();
      
      // Move immediately to next stage or complete
      if (this.currentStage === this.totalStages) {
        console.log('Navigating to result page');
        // Set end time on final completion
        const endTime = Date.now();
        const progress = this.stateService.loadProgress();
        const usedCategories = Array.from(this.usedChallengeCategories);
        this.stateService.saveProgress(
          this.currentStage,
          this.selectedImages,
          this.completedStages,
          progress?.startTime,
          progress?.challengeInstructions,
          endTime,
          this.challenges,
          usedCategories
        );
        this.router.navigate(['/result']);
      } else {
        console.log('Moving to next stage immediately');
        this.currentStage++;
        this.resetStage();
        this.saveCurrentProgress();
        console.log('New stage:', this.currentStage);
      }
      
    } else {
      console.log('FAILURE - Regenerating challenge');
      // FAILURE - Regenerate NEW challenge (proper CAPTCHA behavior)
      this.showValidationMessage(
        `❌ Incorrect ${isTextInput ? 'answer' : 'selection'}. Generating new challenge...`, 
        false
      );
      
      // Regenerate challenge immediately
      this.regenerateCurrentChallenge();
      this.resetStage();
      this.saveCurrentProgress();
    }
  }

  previousStage() {
    if (this.currentStage > 1) {
      this.currentStage--;
      this.resetStage();
      this.saveCurrentProgress();
    }
  }

  private showValidationMessage(message: string, success: boolean) {
    this.validationMessage = message;
    this.isCorrect = success;
    this.showValidation = true;
  }

  private resetValidation() {
    this.showValidation = false;
    this.validationMessage = '';
    this.isCorrect = false;
  }

  private resetStage() {
    this.selectedImages = [];
    this.userTextInput = '';
    this.resetValidation();
  }

  // Regenerate ONLY the current stage's challenge (proper CAPTCHA behavior)
  private regenerateCurrentChallenge() {
    // Remove current stage's category from used categories so it can be regenerated
    const currentChallengeCategory = this.challenges[this.currentStage - 1]?.correctCategory;
    if (currentChallengeCategory) {
      this.usedChallengeCategories.delete(currentChallengeCategory);
    }
    
    // Generate a single new challenge
    const newChallenges = this.generateCaptchaChallenges();
    
    // Replace only the current stage's challenge
    this.challenges[this.currentStage - 1] = newChallenges[0];
    
    // Update saved instructions and challenges
    const challengeInstructions = this.challenges.map(c => c.instruction);
    const usedCategories = Array.from(this.usedChallengeCategories);
    this.stateService.saveProgress(
      this.currentStage,
      [],
      this.completedStages,
      undefined,
      challengeInstructions,
      undefined,
      this.challenges,
      usedCategories
    );
  }

  private resetToInitialState() {
    this.currentStage = 1;
    this.completedStages = [];
    this.resetStage();
  }

  isImageCorrect(index: number): boolean {
    return this.currentChallenge.correctAnswers.includes(index);
  }

  shouldShowIncorrectIndicator(index: number): boolean {
    return this.showValidation && !this.isCorrect && 
           this.selectedImages.includes(index) && !this.isImageCorrect(index);
  }

  private handleCompletedUser() {
    if (this.completedStages.length >= this.totalStages) {
      this.router.navigate(['/result']);
      return;
    }
  }
}
