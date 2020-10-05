import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { NgxMarkdownEditorComponent } from './editor/ngx-markdown-editor.component';
import { NgxMarkdownTextPreviewPipe } from './editor/ngx-markdown-text-preview.pipe';
import { NgxMarkdownViewerDirective } from './editor/ngx-markdown-viewer.directive';
import { NgxMarkdownService } from './editor/ngx-markdown.service';
import { NgxMarkdownMentionDirective } from './mentions/ngx-markdown-mention.directive';
import { NgxMarkdownMentionsComponent } from './mentions/ngx-markdown-mentions.component';

@NgModule({
	declarations: [
		NgxMarkdownEditorComponent,
		NgxMarkdownMentionDirective,
		NgxMarkdownMentionsComponent,
		NgxMarkdownTextPreviewPipe,
		NgxMarkdownViewerDirective,
	],
	exports: [
		NgxMarkdownEditorComponent,
		NgxMarkdownTextPreviewPipe,
		NgxMarkdownViewerDirective,
	],
	imports: [
		CommonModule,
		FormsModule,
		MatButtonModule,
		MatIconModule,
		MatListModule,
		ReactiveFormsModule,
		TextFieldModule,
	],
	providers: [
		NgxMarkdownService,
	],
})
export class NgxMarkdownEditorModule {}
