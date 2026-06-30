import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SqliteService } from './sqlite.service';

describe('SqliteService', () => {
  let service: SqliteService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SqliteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
