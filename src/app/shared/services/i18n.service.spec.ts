import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';

describe('I18nService legal and help translations', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.removeItem('language');
    TestBed.configureTestingModule({
      providers: [I18nService],
    });
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    localStorage.removeItem('language');
  });

  it('returns spanish values by default', () => {
    expect(service.translate('help.title')).toBe('Centro de ayuda');
    expect(service.translate('terms.pageTitle')).toBe('Términos y Condiciones');
    expect(service.translate('privacy.pageTitle')).toBe('Política de Privacidad');
    expect(service.translate('termsAcceptance.accept')).toBe('Aceptar y continuar');
  });

  it('switches translated legal labels to english', () => {
    service.setLanguage('en');

    expect(service.translate('help.title')).toBe('Help center');
    expect(service.translate('terms.pageTitle')).toBe('Terms and Conditions');
    expect(service.translate('privacy.pageTitle')).toBe('Privacy Policy');
    expect(service.translate('termsAcceptance.accept')).toBe('Accept and continue');
  });

  it('switches translated legal labels to portuguese', () => {
    service.setLanguage('pt');

    expect(service.translate('help.title')).toBe('Central de ajuda');
    expect(service.translate('terms.pageTitle')).toBe('Termos e Condicoes');
    expect(service.translate('privacy.pageTitle')).toBe('Politica de Privacidade');
    expect(service.translate('termsAcceptance.accept')).toBe('Aceitar e continuar');
  });

  it('covers representative faq entries across languages', () => {
    expect(service.translate('help.faq.password.question')).toContain('contraseña');

    service.setLanguage('en');
    expect(service.translate('help.faq.password.question')).toContain('password');

    service.setLanguage('pt');
    expect(service.translate('help.faq.password.question')).toContain('senha');
  });
});