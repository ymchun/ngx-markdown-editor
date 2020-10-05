import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Component, ComponentRef, ElementRef, EventEmitter, forwardRef, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';

import { CursorPosition } from '../interfaces/cursor-position';
import { EditorHistory } from '../interfaces/editor-history';
import { MentionConfig } from '../interfaces/mention-config';
import { MentionsResult } from '../interfaces/mentions-result';
import { MentionsSearchTerm } from '../interfaces/mentions-search-term';
import { NgxMarkdownMentionDirective } from '../mentions/ngx-markdown-mention.directive';

@Component({
	providers: [
		{
			multi: true,
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => NgxMarkdownEditorComponent),
		},
	],
	selector: 'ngx-markdown-editor',
	styleUrls: [ './ngx-markdown-editor.scss' ],
	templateUrl: './ngx-markdown-editor.view.html',
})
export class NgxMarkdownEditorComponent implements OnInit, OnDestroy, ControlValueAccessor {
	@ViewChild('editingContainerElement') public editingContainerElement: ElementRef<HTMLDivElement>;
	@ViewChild('shadowCursorElement') public shadowCursorElement: ElementRef<HTMLSpanElement>;
	@ViewChild('shadowEditorElement') public shadowEditorElement: ElementRef<HTMLPreElement>;
	@ViewChild('textareaElement') public textareaElement: ElementRef<HTMLTextAreaElement>;
	@ViewChild(NgxMarkdownMentionDirective) public mentionDirective: NgxMarkdownMentionDirective;

	@Input() public height = '400px';
	@Input() public historySteps = 10;
	@Input() public placeholder = '';
	@Input() public resize = true;

	// for file upload
	@Output() public files = new EventEmitter<File[]>(true);

	// for mentions
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	@Input() public mentionConfigs: MentionConfig<any>[];
	@Output() public mentionSearchTerm = new EventEmitter<MentionsSearchTerm>(true);

	// editor state
	public isDisabled = false;
	public isFullscreen = false;
	public isWriteMode = true;
	public cursorPosition: CursorPosition;
	public screenSizeBreakpoint = 600;

	// editor model
	public markdown = new FormControl('');
	public shadowContentUpper = '';
	public shadowContentLower = '';

	// resize
	private resizeOffset = 0;
	private resizeStart = 0;
	private resizeScrollStart = 0;

	// redo/undo state
	private isPerformingUndoRedo = false;
	private undoStack: EditorHistory[] = [];
	private redoStack: EditorHistory[] = [];

	// full screen
	private fullScreenOverlayRef: OverlayRef;
	private fullScreenComponentRef: ComponentRef<NgxMarkdownEditorComponent>;
	private fullScreenControlSubscription: Subscription;

	// ngModel hooks
	private fnOnChange: (value: string) => void;
	private fnOnTouched: () => void;

	private controlSubscription: Subscription;

	public constructor(
		private overlay: Overlay,
	) {}

	@HostListener('document:keydown', [ '$event' ])
	public keyboardEvent(event: KeyboardEvent): void {
		// get key press
		const key = (event.key || '').toLowerCase();
		// check action
		switch (key) {
		case 'escape': {
			if (this.isFullscreen && !this.isOpenedMentionMenu) {
				this.fullscreen();
			}
			break;
		}
		case 'z': {
			if (this.historySteps > 0 && (event.ctrlKey || event.metaKey)) {
				if (event.shiftKey) {
					this.redo();
				} else {
					this.undo();
				}
				// prevent the default undo/redo handling
				event.preventDefault();
				event.stopPropagation();
			}
			break;
		}
		case 'arrowdown': /* cspell: disable-line */
		case 'arrowleft': /* cspell: disable-line */
		case 'arrowright': /* cspell: disable-line */
		case 'arrowup': { /* cspell: disable-line */
			// update cursor
			this.updateCursor();
			break;
		}
		}
	}

	public ngOnInit(): void {
		// set up resizing functions to global scope
		window['editorResizing'] = (e: MouseEvent) => {
			this.onResizing(e);
		};
		window['editorResizeEnd'] = () => {
			this.onResizeEnd();
		};

		// watch for control value change
		this.controlSubscription = this.markdown.valueChanges
			.pipe(debounce(() => timer(200)))
			.subscribe((value: string) => {
				// save history
				if (this.historySteps > 0) {
					if (!this.isPerformingUndoRedo) {
						this.saveUndo();
					}
					// reset state
					this.isPerformingUndoRedo = false;
				}
				// trigger changes
				if (this.fnOnChange) {
					this.fnOnChange(value);
				}
				if (this.fnOnTouched) {
					this.fnOnTouched();
				}
			});
	}

	public ngOnDestroy(): void {
		if (this.controlSubscription) {
			this.controlSubscription.unsubscribe();
		}
		if (this.fullScreenControlSubscription) {
			this.fullScreenControlSubscription.unsubscribe();
		}
	}

	public get isMobile(): boolean {
		return window.innerWidth < this.screenSizeBreakpoint;
	}

	public get editorHeight(): string {
		const toolbarHeight = this.isMobile ? 81 : 41;
		const borderSizeAdjust = 2;
		return `${parseInt(this.height, 10) + this.resizeOffset - toolbarHeight - borderSizeAdjust}px`;
	}

	public get isInFullscreen(): boolean {
		return !!this.fullScreenComponentRef && !!this.fullScreenComponentRef.instance;
	}

	public get isOpenedMentionMenu(): boolean {
		return this.mentionDirective.menuOpened;
	}

	public writeValue(markdown: string): void {
		if (markdown !== null && markdown !== undefined) {
			this.markdown.setValue(markdown);
		}
	}

	public registerOnChange(fn: (value: string) => void): void {
		this.fnOnChange = fn;
	}

	public registerOnTouched(fn: () => void): void {
		this.fnOnTouched = fn;
	}

	public setDisabledState(isDisabled: boolean): void {
		if (isDisabled) {
			this.markdown.disable();
		}
		this.isDisabled = isDisabled;
	}

	public onDrop(event: DragEvent): void {
		if (event.dataTransfer.files.length > 0) {
			this.files.emit(Array.from(event.dataTransfer.files));
			event.stopPropagation();
			event.preventDefault();
		}
	}

	public onPaste(event: ClipboardEvent): void {
		if (event.clipboardData.files.length > 0) {
			event.stopPropagation();
			event.preventDefault();
			this.files.emit(Array.from(event.clipboardData.files));
		}
		// update cursor
		this.updateCursor();
	}

	public onInput(): void {
		// update cursor
		this.updateCursor();
	}

	public onResizeStart(event: MouseEvent): void {
		if (this.resize && this.isWriteMode) {
			if (this.resizeStart === 0) {
				this.resizeStart = event.clientY;
			}
			if (this.resizeScrollStart === 0) {
				const rect = this.editingContainerElement.nativeElement.getBoundingClientRect();
				this.resizeScrollStart = rect.y;
			}
			document.documentElement.addEventListener('mousemove', window['editorResizing'], false);
			document.documentElement.addEventListener('mouseup', window['editorResizeEnd'], false);
		}
	}

	public onResizing(event: MouseEvent): void {
		const rect = this.editingContainerElement.nativeElement.getBoundingClientRect();
		this.resizeOffset = event.clientY + (this.resizeScrollStart - rect.y) - this.resizeStart;

		if (this.resizeOffset < 0) {
			this.resizeOffset = 0;
		}
	}

	public onResizeEnd(): void {
		document.documentElement.removeEventListener('mousemove', window['editorResizing'], false);
		document.documentElement.removeEventListener('mouseup', window['editorResizeEnd'], false);
	}

	public onEditorScroll(event: Event): void {
		this.shadowEditorElement.nativeElement.scrollTop = (event.target as HTMLElement).scrollTop;
	}

	public updateCursor(): void {
		setTimeout(() => {
			// get selection range
			const position = this.textareaElement.nativeElement.selectionEnd;
			// markdown value
			const value = this.markdown.value as string;
			// set content
			this.shadowContentUpper = value.substring(0, position);
			this.shadowContentLower = value.substring(position);
			// update cursor position
			this.cursorPosition = {
				x: this.shadowCursorElement.nativeElement.offsetLeft,
				y: this.shadowCursorElement.nativeElement.offsetTop,
			};
		});
	}

	public fullscreen(): void {
		// close all mention menu
		this.mentionDirective.closeMenu();

		if (this.isFullscreen) {
			// exit full screen
			if (this.fullScreenControlSubscription) {
				this.fullScreenControlSubscription.unsubscribe();
			}
			if (this.fullScreenComponentRef) {
				this.fullScreenComponentRef.destroy();
			}
			if (this.fullScreenOverlayRef) {
				this.fullScreenOverlayRef.dispose();
			}
		} else {
			// create overlay
			this.fullScreenOverlayRef = this.overlay.create();
			this.fullScreenComponentRef = this.fullScreenOverlayRef.attach(new ComponentPortal(NgxMarkdownEditorComponent));

			this.fullScreenComponentRef.onDestroy(() => {
				// set editor selection
				this.textareaElement.nativeElement.setSelectionRange(
					this.fullScreenComponentRef.instance.textareaElement.nativeElement.selectionStart,
					this.fullScreenComponentRef.instance.textareaElement.nativeElement.selectionEnd,
				);
				// update cursor
				this.updateCursor();
				// unset component reference
				this.fullScreenComponentRef = undefined;
			});

			// set input
			this.fullScreenComponentRef.instance.height = this.height;
			this.fullScreenComponentRef.instance.historySteps = this.historySteps;
			this.fullScreenComponentRef.instance.placeholder = this.placeholder;
			this.fullScreenComponentRef.instance.resize = this.resize;

			// for file upload
			this.fullScreenComponentRef.instance.files = this.files;

			// for mentions
			this.fullScreenComponentRef.instance.mentionConfigs = this.mentionConfigs;
			this.fullScreenComponentRef.instance.mentionSearchTerm = this.mentionSearchTerm;

			// editor state
			this.fullScreenComponentRef.instance.isDisabled = this.isDisabled;
			this.fullScreenComponentRef.instance.isFullscreen = true;
			this.fullScreenComponentRef.instance.isWriteMode = this.isWriteMode;
			this.fullScreenComponentRef.instance.cursorPosition = this.cursorPosition;
			this.fullScreenComponentRef.instance.screenSizeBreakpoint = this.screenSizeBreakpoint;

			// editor model
			this.fullScreenComponentRef.instance.markdown.setValue(this.markdown.value);
			this.fullScreenComponentRef.instance.shadowContentUpper = this.shadowContentUpper;
			this.fullScreenComponentRef.instance.shadowContentLower = this.shadowContentLower;

			// redo/undo state
			this.fullScreenComponentRef.instance.isPerformingUndoRedo = this.isPerformingUndoRedo;
			this.fullScreenComponentRef.instance.undoStack = this.undoStack;
			this.fullScreenComponentRef.instance.redoStack = this.redoStack;

			// full screen
			this.fullScreenComponentRef.instance.fullScreenOverlayRef = this.fullScreenOverlayRef;
			// this.fullScreenComponentRef.instance.fullScreenComponentRef = this.fullScreenComponentRef; <<-- don't un-comment this

			setTimeout(() => {
				// set editor selection
				this.fullScreenComponentRef.instance.textareaElement.nativeElement.setSelectionRange(
					this.textareaElement.nativeElement.selectionStart,
					this.textareaElement.nativeElement.selectionEnd,
				);
				// update cursor
				this.fullScreenComponentRef.instance.updateCursor();
			});

			// pipe overlay markdown
			this.fullScreenControlSubscription = this.fullScreenComponentRef.instance.markdown.valueChanges
				.pipe(debounce(() => timer(50)))
				.subscribe((value: string) => {
					// set value
					this.markdown.setValue(value);
					// trigger changes
					if (this.fnOnChange) {
						this.fnOnChange(value);
					}
					if (this.fnOnTouched) {
						this.fnOnTouched();
					}
				});
		}
	}

	public onSearchResult(result: MentionsResult): void {
		this.insertContent(result.result, result.term.length);
	}

	public onSearchTerm(term: MentionsSearchTerm): void {
		this.mentionSearchTerm.emit(term);
	}

	// formatting function

	public insertLink(): void {
		// get url
		const description = prompt('Enter url text');
		const url = prompt('Enter url');

		if (url) {
			// construct string
			this.insertContent(`[${description}](${url})`);
			// save history
			this.saveUndo();
			// update cursor
			this.updateCursor();
		}
	}

	public insertPhoto(): void {
		// get image url
		const description = prompt('Enter image description (optional)');
		const url = prompt('Enter image url');

		if (url) {
			// construct string
			this.insertContent(`![${description}](${url})`);
			// save history
			this.saveUndo();
			// update cursor
			this.updateCursor();
		}
	}

	public bold(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			`**${value.substring(start, end)}**`,
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public italic(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			`*${value.substring(start, end)}*`,
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public quote(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// manipulate strings
		const lines = value.substring(start, end).split('\n');
		const modifiedString = start === end ? [ '> ' ] : lines.reduce(
			(resultLines, line) => [
				...resultLines,
				`> ${line}`,
			],
			[] as string[],
		);

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			modifiedString.join('\n'),
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public code(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			`\`\`\`\n${value.substring(start, end)}\n\`\`\``,
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public bulletedList(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// manipulate strings
		const lines = value.substring(start, end).split('\n');
		const modifiedString = start === end ? [ '* ' ] : lines.reduce(
			(resultLines, line) => [
				...resultLines,
				`* ${line}`,
			],
			[] as string[],
		);

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			modifiedString.join('\n'),
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public numberedList(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// manipulate strings
		const lines = value.substring(start, end).split('\n');
		const modifiedString = start === end ? [ '1. ' ] : lines.reduce(
			(resultLines, line, index) => [
				...resultLines,
				`${index + 1}. ${line}`,
			],
			[] as string[],
		);

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			modifiedString.join('\n'),
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public taskList(): void {
		// get selection range
		const start = this.textareaElement.nativeElement.selectionStart;
		const end = this.textareaElement.nativeElement.selectionEnd;
		// markdown value
		const value = this.markdown.value as string;

		// manipulate strings
		const lines = value.substring(start, end).split('\n');
		const modifiedString = start === end ? [ '- [ ] ' ] : lines.reduce(
			(resultLines, line) => [
				...resultLines,
				`- [ ] ${line}`,
			],
			[] as string[],
		);

		// construct string
		const result = ''.concat(
			value.substring(0, start),
			modifiedString.join('\n'),
			value.substr(end),
		);

		// update editor
		this.markdown.setValue(result);
		// save history
		this.saveUndo();
		// update cursor
		this.updateCursor();
	}

	public insertContent(content: string, skipBackwardLength = 0): number {
		// insert to fullscreen editor
		if (this.isInFullscreen) {
			return this.fullScreenComponentRef.instance.insertContent(content, skipBackwardLength);
		}
		// insert to this editor
		if (this.textareaElement) {
			// get selection range
			const start = this.textareaElement.nativeElement.selectionStart;
			const end = this.textareaElement.nativeElement.selectionEnd;
			// markdown value
			const value = this.markdown.value as string;

			// construct string
			const result = ''.concat(
				value.substring(0, start - skipBackwardLength),
				content,
				value.substr(end),
			);

			// update editor
			this.markdown.setValue(result);
			// save history
			this.saveUndo();
			// get new cursor position
			const position = start - skipBackwardLength + content.length;
			// update selection range
			this.textareaElement.nativeElement.setSelectionRange(position, position);
			// update cursor
			this.updateCursor();
		}
		return content.length;
	}

	// editor history

	private saveUndo(): void {
		if (this.textareaElement && this.historySteps > 0) {
			// save editor state
			this.undoStack.unshift(new EditorHistory(
				this.markdown.value,
				this.textareaElement.nativeElement.selectionStart,
				this.textareaElement.nativeElement.selectionEnd,
			));

			if (this.undoStack.length > this.historySteps) {
				for (let i = 0; i < this.undoStack.length - this.historySteps; i++) {
					this.undoStack.pop();
				}
			}
			// clear redo stack
			this.redoStack = [];
		}
	}

	private undo(): void {
		if (this.textareaElement && this.historySteps > 0 && this.undoStack.length > 0) {
			// move the first element from undo to redo
			this.redoStack.unshift(this.undoStack.shift());
			// restore editor state
			const [ current ] = this.undoStack;

			if (current) {
				this.isPerformingUndoRedo = true;
				this.markdown.setValue(current.content || '');
				this.textareaElement.nativeElement.setSelectionRange(current.selectionStart, current.selectionEnd);
				this.updateCursor();
			}
		}
	}

	private redo(): void {
		if (this.textareaElement && this.historySteps > 0 && this.redoStack.length > 0) {
			// move the first element from redo to undo
			this.undoStack.unshift(this.redoStack.shift());
			// restore editor state
			const [ current ] = this.undoStack;

			if (current) {
				this.isPerformingUndoRedo = true;
				this.markdown.setValue(current.content || '');
				this.textareaElement.nativeElement.setSelectionRange(current.selectionStart, current.selectionEnd);
				this.updateCursor();
			}
		}
	}

}
