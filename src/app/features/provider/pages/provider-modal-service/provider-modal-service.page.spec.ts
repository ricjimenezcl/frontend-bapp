import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ProviderModalServicePage } from './provider-modal-service.page';

describe('ProviderModalServicePage', () => {
  let component: ProviderModalServicePage;
  let fixture: ComponentFixture<ProviderModalServicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderModalServicePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideIonicAngular(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderModalServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
