import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ClientChatsPage } from './client-chats.page';

describe('ClientChatsPage', () => {
  let component: ClientChatsPage;
  let fixture: ComponentFixture<ClientChatsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientChatsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientChatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
