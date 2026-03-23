import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderServiceDetailsPage } from './provider-service-details.page';

describe('ProviderServiceDetailsPage', () => {
  let component: ProviderServiceDetailsPage;
  let fixture: ComponentFixture<ProviderServiceDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderServiceDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
