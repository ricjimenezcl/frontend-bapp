import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SelectionService } from './selection.service';

describe('SelectionService', () => {
  let service: SelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
