import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderInfoPage } from './provider-info.page';

describe('ProviderInfoPage', () => {
  let component: ProviderInfoPage;
  let fixture: ComponentFixture<ProviderInfoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
