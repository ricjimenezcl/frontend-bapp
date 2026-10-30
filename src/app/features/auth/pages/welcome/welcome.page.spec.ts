import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { WelcomePage } from './welcome.page';

describe('WelcomePage', () => {
  let component: WelcomePage;
  let fixture: ComponentFixture<WelcomePage>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WelcomePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideIonicAngular(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect to categories when the onboarding was already shown', () => {
    localStorage.setItem('bapp_welcome_seen', '1');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    const welcome = TestBed.createComponent(WelcomePage);
    welcome.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/client/categories']);
  });
});
