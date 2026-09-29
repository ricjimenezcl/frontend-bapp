import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ProviderInboxPage } from './provider-inbox.page';

describe('ProviderInboxPage', () => {
  let component: ProviderInboxPage;
  let fixture: ComponentFixture<ProviderInboxPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderInboxPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderInboxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
