import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { of } from 'rxjs';
import { RegisterClientPage } from './register-client.page';

describe('RegisterClientPage', () => {
  let component: RegisterClientPage;
  let fixture: ComponentFixture<RegisterClientPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterClientPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SocialAuthService, useValue: { authState: of(null), signIn: () => Promise.resolve({}), signOut: () => Promise.resolve() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterClientPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
