import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainCategoriesPage } from './main-categories.page';

describe('MainCategoriesPage', () => {
  let component: MainCategoriesPage;
  let fixture: ComponentFixture<MainCategoriesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MainCategoriesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
