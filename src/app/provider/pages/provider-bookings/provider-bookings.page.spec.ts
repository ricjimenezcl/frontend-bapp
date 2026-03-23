import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderBookingsPage } from './provider-bookings.page';

describe('ProviderBookingsPage', () => {
  let component: ProviderBookingsPage;
  let fixture: ComponentFixture<ProviderBookingsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderBookingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
