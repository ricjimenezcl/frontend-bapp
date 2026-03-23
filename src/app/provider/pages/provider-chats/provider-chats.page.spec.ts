import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProviderChatsPage } from './provider-chats.page';

describe('ProviderChatsPage', () => {
  let component: ProviderChatsPage;
  let fixture: ComponentFixture<ProviderChatsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProviderChatsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
