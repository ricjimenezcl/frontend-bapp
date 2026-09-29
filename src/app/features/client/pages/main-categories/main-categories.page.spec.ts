import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MainCategoriesPage } from './main-categories.page';

describe('MainCategoriesPage', () => {
  let component: MainCategoriesPage;
  let fixture: ComponentFixture<MainCategoriesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainCategoriesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MainCategoriesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
