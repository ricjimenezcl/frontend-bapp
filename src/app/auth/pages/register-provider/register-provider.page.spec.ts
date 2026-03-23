import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterProviderPage } from './register-provider.page';

describe('RegisterProviderPage', () => {
  let component: RegisterProviderPage;
  let fixture: ComponentFixture<RegisterProviderPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegisterProviderPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
