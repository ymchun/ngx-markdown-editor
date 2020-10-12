import { FlexibleConnectedPositionStrategy, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
	ComponentRef,
	Directive,
	ElementRef,
	EventEmitter,
	HostListener,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	Output,
	SimpleChanges,
} from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
import { CursorPosition } from '../interfaces/cursor-position';
import { MentionConfig } from '../interfaces/mention-config';
import { MentionsResult } from '../interfaces/mentions-result';
import { MentionsSearchTerm } from '../interfaces/mentions-search-term';
import { NgxMarkdownMentionsComponent } from './ngx-markdown-mentions.component';

@Directive({
	selector: '[ngxMarkdownMention]',
})
export class NgxMarkdownMentionDirective implements OnInit, OnDestroy, OnChanges {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input('ngxMarkdownMention') private configs: MentionConfig<any>[];
	@Input() private cursorPosition: CursorPosition;
	@Output() private searchResult = new EventEmitter<MentionsResult>(true);
	@Output() private searchTerm = new EventEmitter<MentionsSearchTerm>(true);

	public menuOpened = false;
	private itemCount = 0;
	private triggerCharPosition = 0;
	private triggerChar = '';
	private triggerTerm = '';
	private triggerMap = {};

	private overlayRef: OverlayRef;
	private componentRef: ComponentRef<NgxMarkdownMentionsComponent>;
	private countSubscription: Subscription;
	private destroySubscription: Subscription;
	private selectSubscription: Subscription;

	private searchTermDebounceSubscription: Subscription;
	private searchTermDebounce: Subject<void> = new Subject();

	public constructor(private elementRef: ElementRef<HTMLTextAreaElement>, private overlay: Overlay) {}

	@HostListener('input', ['$event'])
	public onInput(event: InputEvent): void {
		// check if any trigger
		if (!this.configs) {
			return;
		}

		// when typed text
		if (event.inputType === 'insertText' && event.data) {
			// get the last char
			const char = Array.from(event.data).pop();

			// exit when typed space
			if (char === ' ') {
				this.closeMenu();
				return;
			}

			// check if char in trigger map
			if (this.triggerMap[char]) {
				// if already searching, terminate the search
				if (this.menuOpened) {
					this.closeMenu();
					return;
				}
				// save action trigger
				this.triggerCharPosition = this.elementRef.nativeElement.selectionEnd;
				this.triggerChar = char;
				// open menu
				this.openMenu();
			} else {
				// emit search term when menu opened
				if (this.menuOpened) {
					// update and emit search term
					this.emitSearchTerm();
				}
			}
		}

		// when delete text backward (using backspace)
		if (this.menuOpened && event.inputType === 'deleteContentBackward') {
			if (
				this.elementRef.nativeElement.value &&
				this.elementRef.nativeElement.selectionEnd >= this.triggerCharPosition
			) {
				// update and emit search term
				this.emitSearchTerm();
			} else {
				// close menu when no content
				this.closeMenu();
			}
		}
	}

	public ngOnInit(): void {
		this.searchTermDebounceSubscription = this.searchTermDebounce.pipe(debounce(() => timer(200))).subscribe(() => {
			this.searchTerm.emit({
				term: this.triggerTerm,
				trigger: this.triggerChar,
			});
		});
	}

	public ngOnDestroy(): void {
		if (this.searchTermDebounceSubscription) {
			this.searchTermDebounceSubscription.unsubscribe();
		}
		// destroy previous overlay
		this.dispose();
	}

	public ngOnChanges(changes: SimpleChanges): void {
		// update config trigger map
		if (changes.configs && changes.configs.currentValue) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const configs = changes.configs.currentValue as MentionConfig<any>[];
			this.triggerMap = configs.reduce(
				(mapping, config) => ({
					...mapping,
					[config.trigger]: config,
				}),
				{},
			);
		}
		// update menu position
		if (changes.cursorPosition && changes.cursorPosition.currentValue && this.menuOpened) {
			this.updateMenuPosition();
		}
	}

	public closeMenu(): void {
		// reset state
		this.menuOpened = false;
		this.triggerCharPosition = 0;
		this.triggerChar = '';
		this.triggerTerm = '';
		// destroy previous overlay
		this.dispose();
	}

	private openMenu(): void {
		// destroy previous overlay
		this.dispose();

		// get config
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const config = this.triggerMap[this.triggerChar] as MentionConfig<any>;

		if (config) {
			// set opened
			this.menuOpened = true;

			// create overlay
			this.overlayRef = this.overlay.create({
				positionStrategy: this.getPositionStrategy(this.cursorPosition.x + 10, this.cursorPosition.y + 20),
			});
			this.componentRef = this.overlayRef.attach(new ComponentPortal(NgxMarkdownMentionsComponent));

			// set input
			this.componentRef.instance.data = config.data;
			this.componentRef.instance.template = config.template;

			// subscribe to output

			this.countSubscription = this.componentRef.instance.count.subscribe((count: number) => {
				// set count
				this.itemCount = count;
				// update menu position
				this.updateMenuPosition();
			});

			this.destroySubscription = this.componentRef.instance.destroy.subscribe(() => this.closeMenu());

			this.selectSubscription = this.componentRef.instance.selected.subscribe((item: string) => {
				// insert content
				this.searchResult.emit({
					result: config.transform ? config.transform(item) : item,
					term: this.triggerTerm,
				});
				// close menu
				this.closeMenu();
			});
		}
	}

	private getPositionStrategy(x: number, y: number): FlexibleConnectedPositionStrategy {
		return this.overlay
			.position()
			.flexibleConnectedTo(this.elementRef.nativeElement)
			.withPositions([
				{
					offsetX: x,
					offsetY: y,
					originX: 'start',
					originY: 'top',
					overlayX: 'start',
					overlayY: 'top',
				},
			]);
	}

	private updateMenuPosition(): void {
		if (this.overlayRef) {
			// determine flip upwards or downwards
			const rect = this.elementRef.nativeElement.getBoundingClientRect();
			const menuHeight = this.itemCount * 40 + 6; // with item height 40px and padding top 6px
			const menuBottom = rect.y + this.cursorPosition.y + menuHeight;

			if (window.innerHeight < menuBottom) {
				this.overlayRef.updatePositionStrategy(
					this.getPositionStrategy(this.cursorPosition.x + 10, this.cursorPosition.y - menuHeight),
				);
			} else {
				this.overlayRef.updatePositionStrategy(
					this.getPositionStrategy(this.cursorPosition.x + 10, this.cursorPosition.y + 20),
				);
			}
		}
	}

	private emitSearchTerm(): void {
		if (this.elementRef && this.elementRef.nativeElement) {
			// get current value
			const value = this.elementRef.nativeElement.value || '';
			// get cursor position
			const position = this.elementRef.nativeElement.selectionEnd;

			if (this.triggerCharPosition <= position) {
				this.triggerTerm = value.substring(this.triggerCharPosition, position);
				this.searchTermDebounce.next();
			}
		}
	}

	private dispose(): void {
		if (this.countSubscription) {
			this.countSubscription.unsubscribe();
			this.countSubscription = undefined;
		}
		if (this.destroySubscription) {
			this.destroySubscription.unsubscribe();
			this.destroySubscription = undefined;
		}
		if (this.selectSubscription) {
			this.selectSubscription.unsubscribe();
			this.selectSubscription = undefined;
		}
		if (this.componentRef) {
			this.componentRef.destroy();
			this.componentRef = undefined;
		}
		if (this.overlayRef) {
			this.overlayRef.dispose();
			this.overlayRef = undefined;
		}
	}
}
