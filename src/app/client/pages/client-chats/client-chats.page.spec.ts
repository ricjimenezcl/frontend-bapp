import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientChatsPage } from './client-chats.page';

describe('ClientChatsPage', () => {
  let component: ClientChatsPage;
  let fixture: ComponentFixture<ClientChatsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ClientChatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
