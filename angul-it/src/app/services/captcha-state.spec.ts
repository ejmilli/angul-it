import { TestBed } from '@angular/core/testing';

import { CaptchaState } from './captcha-state';

describe('CaptchaState', () => {
  let service: CaptchaState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaptchaState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
