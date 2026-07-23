import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { I18nService } from '../../../../shared/services/i18n.service';

interface HelpFaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-help',
  templateUrl: './help.page.html',
  styleUrls: ['./help.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class HelpPage {
  constructor(
    private router: Router,
    public readonly i18n: I18nService,
  ) {}

  readonly faqs: HelpFaqItem[] = [
    {
      questionKey: 'help.faq.password.question',
      answerKey: 'help.faq.password.answer',
    },
    {
      questionKey: 'help.faq.avatar.question',
      answerKey: 'help.faq.avatar.answer',
    },
    {
      questionKey: 'help.faq.darkMode.question',
      answerKey: 'help.faq.darkMode.answer',
    },
  ];

  goBack(): void {
    this.router.navigate(['/client/settings']);
  }

  goToTerms(): void {
    this.router.navigate(['/terms']);
  }

  goToPrivacy(): void {
    this.router.navigate(['/privacy']);
  }
}
