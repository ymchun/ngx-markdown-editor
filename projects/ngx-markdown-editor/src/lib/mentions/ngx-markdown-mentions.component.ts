import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, TemplateRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

@Component({
	styleUrls: ['./ngx-markdown-mentions.scss'],
	templateUrl: './ngx-markdown-mentions.view.html',
})
export class NgxMarkdownMentionsComponent implements OnInit, OnDestroy {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input() public data: Observable<any[]>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input() public template: TemplateRef<any>;
	@Output() public count = new EventEmitter<number>(true);
	@Output() public destroy = new EventEmitter<void>(true);
	@Output() public selected = new EventEmitter<string>(true);

	public activeIndex = 0;
	public items = [];

	private subscription: Subscription;

	@HostListener('document:keydown', ['$event'])
	public keyboardEvent(event: KeyboardEvent): void {
		// get key press
		const key = event.key.toLowerCase();
		// check action
		switch (key) {
			case 'enter': {
				if (this.items.length > 0) {
					this.onClick(this.activeIndex);
					// stop event
					event.preventDefault();
					event.stopPropagation();
				}
				break;
			}
			case 'escape': {
				this.destroy.emit();
				// stop event
				event.preventDefault();
				event.stopPropagation();
				break;
			}
			case 'arrowdown': {
				if (this.items.length > 0) {
					// increase index
					this.activeIndex++;
					// check overflow
					if (this.activeIndex > this.items.length - 1) {
						this.activeIndex = 0;
					}
					// stop event
					event.preventDefault();
					event.stopPropagation();
				}
				break;
			}
			case 'arrowup': {
				if (this.items.length > 0) {
					// increase index
					this.activeIndex--;
					// check overflow
					if (this.activeIndex < 0) {
						this.activeIndex = this.items.length - 1;
					}
					// stop event
					event.preventDefault();
					event.stopPropagation();
				}
				break;
			}
		}
	}

	public ngOnInit(): void {
		this.subscription = this.data.subscribe((items) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			this.items = [...items];
			this.count.emit(this.items.length);
		});
	}

	public ngOnDestroy(): void {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}

	public get hasResult(): boolean {
		return this.items && this.items.length > 0;
	}

	public onClick(index: number): void {
		this.selected.emit(this.items[index]);
	}
}
