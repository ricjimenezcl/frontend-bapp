import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { of } from 'rxjs';
import { RegisterProviderPage } from './register-provider.page';

describe('RegisterProviderPage', () => {
  let component: RegisterProviderPage;
  let fixture: ComponentFixture<RegisterProviderPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterProviderPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SocialAuthService, useValue: { authState: of(null), signIn: () => Promise.resolve({}), signOut: () => Promise.resolve() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterProviderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
