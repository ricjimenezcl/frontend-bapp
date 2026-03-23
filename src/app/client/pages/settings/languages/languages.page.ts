import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-languages',
  templateUrl: './languages.page.html',
  styleUrls: ['./languages.page.scss']
})
export class LanguagesPage {
  constructor(private readonly router: Router) {}

  goBack() {
    this.router.navigate(['../settings']);
  }
}
