import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ProviderChatsPage } from './provider-chats.page';

describe('ProviderChatsPage', () => {
  let component: ProviderChatsPage;
  let fixture: ComponentFixture<ProviderChatsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderChatsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderChatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
