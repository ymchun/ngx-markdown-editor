import { Pipe, PipeTransform } from '@angular/core';

import { NgxMarkdownService } from './ngx-markdown.service';

@Pipe({
	name: 'ngxMarkdownTextPreview',
})
export class NgxMarkdownTextPreviewPipe implements PipeTransform {

	public constructor(
		private ngxMarkdownService: NgxMarkdownService,
	) {}

	public transform(markdown: string): string {
		if (markdown) {
			const html = this.ngxMarkdownService.parse(markdown);
			const placeholder = document.createElement('div');
			placeholder.innerHTML = this.filterHTML(html);
			return placeholder.textContent;
		}
		return '';
	}

	private filterHTML(html: string): string {
		const dom = (new DOMParser()).parseFromString(html, 'text/html');

		// remove images
		const imgTags = Array.from<HTMLImageElement>(dom.querySelectorAll('img'));

		for (const imgTag of imgTags) {
			imgTag.remove();
		}

		return (new XMLSerializer()).serializeToString(dom);
	}
}
