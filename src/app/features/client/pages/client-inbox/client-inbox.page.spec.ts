import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ClientInboxPage } from './client-inbox.page';

describe('ClientInboxPage', () => {
  let component: ClientInboxPage;
  let fixture: ComponentFixture<ClientInboxPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientInboxPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientInboxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
