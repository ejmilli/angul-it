import { Injectable } from '@angular/core';

// Browser check helper
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

interface CaptchaProgress {
  currentStage: number;
  selectedImages: number[];
  completedStages: number[];
  timestamp: number;
  startTime: number;
  endTime?: number | null; // Track completion time
  challengeInstructions?: string[]; // Store actual challenge instructions
}

@Injectable({
  providedIn: 'root'
})
export class CaptchaState {
  private readonly STORAGE_KEY = 'angul-it-captcha-progress';
  private readonly EXPIRY_HOURS = 24;

  constructor() {}

  saveProgress(currentStage: number, selectedImages: number[], completedStages: number[], startTime?: number, challengeInstructions?: string[], endTime?: number | null): void {
    if (!isBrowser()) return; // Guard for SSR
    
    const existingProgress = this.loadProgress();
    
    const progress: CaptchaProgress = {
      currentStage,
      selectedImages,
      completedStages,
      timestamp: Date.now(),
      startTime: startTime || existingProgress?.startTime || Date.now(),
      endTime: endTime !== undefined ? endTime : existingProgress?.endTime,
      challengeInstructions: challengeInstructions || existingProgress?.challengeInstructions
    };
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
    }
  }

  initializeProgress(): void {
    if (!isBrowser()) return; // Guard for SSR
    
    const startTime = Date.now();
    this.saveProgress(1, [], [], startTime, undefined, null); // Initialize endTime as null
  }

  loadProgress(): CaptchaProgress | null {
    if (!isBrowser()) return null; // Guard for SSR
    
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) {
        return null;
      }

      const progress: CaptchaProgress = JSON.parse(saved);
      
      if (this.isProgressExpired(progress.timestamp)) {
        this.clearProgress();
        return null;
      }

      // Basic validation to prevent tampering
      progress.completedStages = progress.completedStages.filter((s: number) => s >= 1 && s <= 3);
      
      return progress;
    } catch (error) {
      console.error('Failed to load progress from localStorage:', error);
      return null;
    }
  }

  clearProgress(): void {
    if (!isBrowser()) return; // Guard for SSR
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear progress:', error);
    }
  }

  private isProgressExpired(timestamp: number): boolean {
    const expiryTime = this.EXPIRY_HOURS * 60 * 60 * 1000;
    return (Date.now() - timestamp) > expiryTime;
  }

  hasSavedProgress(): boolean {
    if (!isBrowser()) return false; // Guard for SSR
    
    const progress = this.loadProgress();
    return progress !== null;
  }

  getProgressSummary(): { stage: number; total: number } | null {
    if (!isBrowser()) return null; // Guard for SSR
    
    const progress = this.loadProgress();
    if (!progress) {
      return null;
    }
    
    return {
      stage: progress.currentStage,
      total: 3
    };
  }
}
