import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderHomePage } from './provider-home.page';

describe('ProviderHomePage', () => {
  let component: ProviderHomePage;
  let fixture: ComponentFixture<ProviderHomePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderHomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
