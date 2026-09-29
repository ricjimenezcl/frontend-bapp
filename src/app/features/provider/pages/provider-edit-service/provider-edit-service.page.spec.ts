import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ProviderEditServicePage } from './provider-edit-service.page';

describe('ProviderEditServicePage', () => {
  let component: ProviderEditServicePage;
  let fixture: ComponentFixture<ProviderEditServicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderEditServicePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderEditServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
