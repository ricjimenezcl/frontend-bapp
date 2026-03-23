import { Pipe, PipeTransform } from '@angular/core';

const DEFAULT_AVATAR = 'assets/images/default-avatar.png';

@Pipe({ name: 'providerImage', standalone: true })
export class ProviderImagePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return DEFAULT_AVATAR;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('data:')) return value;
    // Raw base64 string
    return 'data:image/jpeg;base64,' + value;
  }
}
