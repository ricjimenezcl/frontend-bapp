import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ClientProfilePage } from './client-profile.page';

describe('ClientProfilePage', () => {
  let component: ClientProfilePage;
  let fixture: ComponentFixture<ClientProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientProfilePage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
