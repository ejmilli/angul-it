import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Captcha } from './captcha';

describe('Captcha', () => {
  let component: Captcha;
  let fixture: ComponentFixture<Captcha>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Captcha]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Captcha);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
