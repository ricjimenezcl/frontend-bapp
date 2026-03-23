import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceMapPage } from './service-map.page';

describe('ServiceMapPage', () => {
  let component: ServiceMapPage;
  let fixture: ComponentFixture<ServiceMapPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
