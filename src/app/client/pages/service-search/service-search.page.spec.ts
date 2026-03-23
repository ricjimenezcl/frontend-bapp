import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceSearchPage } from './service-search.page';

describe('ServiceSearchPage', () => {
  let component: ServiceSearchPage;
  let fixture: ComponentFixture<ServiceSearchPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceSearchPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
