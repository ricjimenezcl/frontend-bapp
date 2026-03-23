import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderAddServicePage } from './provider-add-service.page';

describe('ProviderAddServicePage', () => {
  let component: ProviderAddServicePage;
  let fixture: ComponentFixture<ProviderAddServicePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderAddServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
