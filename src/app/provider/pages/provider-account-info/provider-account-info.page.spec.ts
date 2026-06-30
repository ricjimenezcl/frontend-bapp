import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ProviderAccountInfoPage } from './provider-account-info.page';

describe('ProviderAccountInfoPage', () => {
  let component: ProviderAccountInfoPage;
  let fixture: ComponentFixture<ProviderAccountInfoPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderAccountInfoPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideIonicAngular(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderAccountInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
