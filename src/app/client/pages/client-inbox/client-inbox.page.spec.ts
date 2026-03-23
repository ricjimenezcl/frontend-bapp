import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClientInboxPage } from './client-inbox.page';
import { ChatService } from '../../../core/services/chat.service';
import { WebSocketService } from '../../../core/services/websocket.service';

describe('ClientInboxPage', () => {
  let component: ClientInboxPage;
  let fixture: ComponentFixture<ClientInboxPage>;

  const chatServiceMock = {
    loadConversations: jasmine.createSpy('loadConversations').and.returnValue(of([]))
  };

  const routerMock = {
    navigate: jasmine.createSpy('navigate')
  };

  const webSocketServiceMock = {
    connectToNotifications: jasmine.createSpy('connectToNotifications').and.returnValue(Promise.resolve()),
    getNotifications$: jasmine.createSpy('getNotifications$').and.returnValue(of())
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientInboxPage],
      providers: [
        { provide: ChatService, useValue: chatServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: WebSocketService, useValue: webSocketServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientInboxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
