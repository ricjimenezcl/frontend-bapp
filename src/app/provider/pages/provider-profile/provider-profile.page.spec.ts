import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderProfilePage } from './provider-profile.page';

describe('ProviderProfilePage', () => {
  let component: ProviderProfilePage;
  let fixture: ComponentFixture<ProviderProfilePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
