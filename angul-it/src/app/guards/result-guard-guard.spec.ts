import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { resultGuardGuard } from './result-guard-guard';

describe('resultGuardGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => resultGuardGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
