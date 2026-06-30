import { Component, OnInit } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BaseComponent } from './base.component';

// BaseComponent es abstracto — se prueba mediante una subclase concreta
@Component({ template: '', standalone: true })
class TestComponent extends BaseComponent implements OnInit {
  constructor() { super(); }
  ngOnInit() {}
}

describe('BaseComponent', () => {
  let component: TestComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    const fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debe tener destroy$ Subject', () => {
    expect(component['destroy$']).toBeDefined();
  });

  it('ngOnDestroy debe completar destroy$', () => {
    let completed = false;
    component['destroy$'].subscribe({ complete: () => (completed = true) });
    component.ngOnDestroy();
    expect(completed).toBe(true);
  });
});
