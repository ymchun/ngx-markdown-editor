import { Directive, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { NgxMarkdownService } from './ngx-markdown.service';

@Directive({
	selector: '[ngxMarkdownViewer]',
})
export class NgxMarkdownViewerDirective implements OnChanges {
	@Input() public markdown: string;
	@Input() public styles: string;
	@Input() public getTagUrl: (tag: string) => string;
	@Output() private mentions = new EventEmitter<string>(true);
	@Output() private mentionWithIds = new EventEmitter<[ string, string ]>(true);
	@Output() private ready = new EventEmitter<boolean>(true);
	@Output() private tags = new EventEmitter<string>(true);
	@Output() private taskLists = new EventEmitter<string>(true);
	@HostBinding('style.border') public border = 'none';
	@HostBinding('style.height') public iframeHeight = '0px';
	@HostBinding('style.width') public iframeWidth = '0px';

	private iframeDocument: Document;
	private iframeStyle = `
		<style type="text/css">
		body {
			font-family: Roboto, "Helvetica Neue", sans-serif; /* cspell: disable-line */
			margin: 0;
			word-wrap: break-word;
		}
		a {
			border-radius: 0;
			color: #337ab7;
			font-weight: normal;
			text-decoration: none;
			width: 100%;
			word-wrap: break-all;
		}
		a:focus, a:hover {
			background-color: transparent;
			color: #23527c;
			text-decoration: underline;
		}
		blockquote {
			border-left: 5px #cccccc solid;
			margin: 13px 40px;
			padding: 2px 8px 2px 20px;
		}
		code {
			background-color: #fcedea;
			border-radius: 3px;
			color: #c0341d;
			font-size: 90%;
			padding: 2px 4px;
		}
		pre {
			border-radius: 2px;
			border: 1px solid #e5e5e5;
			display: block;
			line-height: 1.6em;
			margin: 16px 4px;
			overflow-x: auto;
			padding: 10px;
			word-break: break-all;
			word-wrap: break-word;
		}
		pre code {
			background-color: transparent;
			color: #333;
		}
		table {
			border-collapse: collapse;
			border-spacing: 0;
			border: 1px solid #ddd;
			margin: 5px;
		}
		table tr:nth-child(even) {
			background-color: #efefef;
		}
		table th {
			border: 1px solid #ddd;
			font-weight: bold;
			padding: 10px;
		}
		table td {
			border: 1px solid #ddd;
			padding: 10px;
		}
		h1, h2, h3, h4, h5 {
			line-height: 1;
		}
		img {
			border: 1px #e0e0e0 solid;
			display: block;
			height: auto;
			max-width: calc(100% - 10px);
			padding: 4px;
		}
		p {
			margin: 0;
		}
		p + p {
			padding-top: 16px;
		}
		.contains-task-list {
			list-style: none;
			padding-left: 20px;
		}
		</style>
	`;

	public constructor(
		private elementRef: ElementRef<HTMLIFrameElement>,
		private ngxMarkdownService: NgxMarkdownService,
		private sanitizer: DomSanitizer,
	) {}

	public getContentDocument(): Document {
		if (!this.iframeDocument) {
			// get iframe html element
			const iframeElement = this.elementRef.nativeElement;
			// get content document
			this.iframeDocument = iframeElement.contentWindow.document || iframeElement.contentDocument;
		}
		return this.iframeDocument;
	}

	@HostListener('load')
	public async onLoad(): Promise<void> {
		// update height
		await this.updateSize();

		// search for mentions
		const mentions = this.getContentDocument().querySelectorAll('[data-mention-name]');

		if (mentions.length > 0) {
			mentions.forEach((mention: HTMLElement) => {
				mention.addEventListener('click', (event) => {
					const id = mention.dataset.mentionId;
					const name = mention.dataset.mentionName;

					if (id) {
						this.mentionWithIds.emit([ id, name ]);
					} else {
						this.mentions.emit(name);
					}
					event.preventDefault();
					event.stopPropagation();
				});
			});
		}

		// search for hash tags
		const hashTags = this.getContentDocument().querySelectorAll('[data-mention-tag]');

		if (hashTags.length > 0) {
			hashTags.forEach((hashTag: HTMLElement) => {
				hashTag.addEventListener('click', (event) => {
					this.tags.emit(hashTag.dataset.mentionTag);
					event.preventDefault();
					event.stopPropagation();
				});
			});
		}

		// search for task lists
		const taskListItems = this.getContentDocument().querySelectorAll('.task-list-item-checkbox');

		if (taskListItems.length > 0) {
			taskListItems.forEach((taskListItem, index) => {
				taskListItem.addEventListener('click', (event) => {
					if (this.markdown) {
						const normalized = [ '* [ ] ', '* [x] ', '- [x] ' ].reduce((str, deli) => str.split(deli).join('- [ ] '), this.markdown);
						const position = (new Array(index).fill(0) as number[]).reduce((pos) => normalized.indexOf('- [ ] ', pos + 1), normalized.indexOf('- [ ] '));
						const result = this.markdown.substring(0, position + 3)
						+ (this.markdown.charAt(position + 3) === ' ' ? 'x' : ' ')
						+ this.markdown.substring(position + 4);

						this.taskLists.emit(result);
					}
					event.preventDefault();
					event.stopPropagation();
				});
			});
		}

		// notify done
		this.ready.emit(true);
	}

	public ngOnChanges(changes: SimpleChanges): void {
		// when new email bind then re-paint iframe content
		if (changes.markdown) {
			// notify loading
			this.ready.emit(false);
			// additional styles
			const additionalStyles = this.styles ? `<style type="text/css">${this.styles}</style>` : '';
			// parse markdown
			const html = this.iframeStyle + additionalStyles + this.ngxMarkdownService.parse(changes.markdown.currentValue);
			// bypass html security check
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const secureHTML: any = this.sanitizer.bypassSecurityTrustHtml(html);
			// filter html content
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const filteredHTML = this.filterHTML(secureHTML.changingThisBreaksApplicationSecurity);
			// write html
			this.getContentDocument().open();
			this.getContentDocument().write(filteredHTML);
			this.getContentDocument().close();
		}
	}

	public updateSize(): Promise<void> {
		return new Promise((resolve: () => void) => {
			// set height
			setTimeout(() => {
				// get height
				const htmlHeight = this.getContentDocument().querySelector('html').scrollHeight;
				const bodyHeight = this.getContentDocument().querySelector('body').scrollHeight;
				// get width
				const htmlWidth = this.getContentDocument().querySelector('html').scrollWidth;
				const bodyWidth = this.getContentDocument().querySelector('body').scrollWidth;
				// update iframe size
				this.iframeHeight = `${Math.max(htmlHeight, bodyHeight)}px`;
				this.iframeWidth = `${Math.max(htmlWidth, bodyWidth)}px`;
				resolve();
			});
		});
	}

	private filterHTML(html: string): string {
		// parse HTML
		const dom = (new DOMParser()).parseFromString(html, 'text/html');

		// hide excess content
		const htmlTag = dom.querySelector('html');

		if (htmlTag) {
			htmlTag.style.overflow = 'hidden';
		}

		// set link target
		const links = dom.querySelectorAll('a');

		for (let i = 0; i < links.length; i++) {
			links.item(i).setAttribute('target', '_blank');
		}

		// set mention tag url
		if (this.getTagUrl) {
			const mentionTags = dom.querySelectorAll('[data-mention-tag]');

			for (let i = 0; i < mentionTags.length; i++) {
				const value = (mentionTags.item(i) as HTMLElement).dataset.mentionTag;
				mentionTags.item(i).setAttribute('href', this.getTagUrl(value));
			}
		}

		// convert back to string
		return (new XMLSerializer()).serializeToString(dom);
	}

}
