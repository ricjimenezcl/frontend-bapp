import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderModalServicePage } from './provider-modal-service.page';

describe('ProviderModalServicePage', () => {
  let component: ProviderModalServicePage;
  let fixture: ComponentFixture<ProviderModalServicePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderModalServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
