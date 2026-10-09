import { Component, computed, input } from '@angular/core';

export type BggCreditSize = 'sm' | 'md' | 'lg';

/**
 * The "Powered by BGG" credit, which BoardGameGeek requires any public-facing
 * use of their XML API to display, linked back to the site and "sized so that
 * the text remains easily legible".
 *
 * The reversed (white and orange) artwork is used because every surface in
 * this app is dark. 130px is about the smallest width where the wordmark still
 * reads, so `sm` is the floor rather than a free choice.
 */
@Component({
  selector: 'app-bgg-credit',
  template: `
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noopener noreferrer"
      [attr.aria-label]="'Powered by BoardGameGeek (opens boardgamegeek.com)'"
      class="inline-block opacity-80 hover:opacity-100 transition-opacity"
      data-testid="bgg-credit"
    >
      <img
        src="bgg/powered-by-bgg.svg"
        alt="Powered by BoardGameGeek"
        [class]="widthClass()"
        class="h-auto"
      />
    </a>
  `,
})
export class BggCredit {
  readonly size = input<BggCreditSize>('md');

  protected widthClass = computed(
    () => ({ sm: 'w-[130px]', md: 'w-[170px]', lg: 'w-[220px]' })[this.size()],
  );
}
