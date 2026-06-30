import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MapboxService } from './mapbox.service';

describe('MapboxService', () => {
  let service: MapboxService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MapboxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
