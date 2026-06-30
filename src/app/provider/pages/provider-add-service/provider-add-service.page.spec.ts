import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { ProviderAddServicePage } from './provider-add-service.page';

describe('ProviderAddServicePage', () => {
  let component: ProviderAddServicePage;
  let fixture: ComponentFixture<ProviderAddServicePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderAddServicePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideIonicAngular(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderAddServicePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
