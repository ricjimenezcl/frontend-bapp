import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ProviderBookingsPage } from './provider-bookings.page';

describe('ProviderBookingsPage', () => {
  let component: ProviderBookingsPage;
  let fixture: ComponentFixture<ProviderBookingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderBookingsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderBookingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
