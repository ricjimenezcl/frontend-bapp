import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderAccountInfoPage } from './provider-account-info.page';

describe('ProviderAccountInfoPage', () => {
  let component: ProviderAccountInfoPage;
  let fixture: ComponentFixture<ProviderAccountInfoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderAccountInfoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
