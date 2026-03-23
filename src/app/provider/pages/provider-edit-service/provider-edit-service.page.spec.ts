import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderEditServicePage } from './provider-edit-service.page';

describe('ProviderEditServicePage', () => {
  let component: ProviderEditServicePage;
  let fixture: ComponentFixture<ProviderEditServicePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderEditServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
