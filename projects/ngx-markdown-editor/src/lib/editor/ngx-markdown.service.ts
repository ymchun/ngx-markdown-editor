import { Injectable } from '@angular/core';
import MarkdownIt from 'markdown-it';
import TaskList from 'markdown-it-task-lists';
import { MarkdownItHashTag } from '../markdown-it-plugins/markdown-it-hash-tag';
import { MarkdownItMentionWithId } from '../markdown-it-plugins/markdown-it-mention-with-id';
import { MarkdownItMentions } from '../markdown-it-plugins/markdown-it-mentions';
import { MarkdownItTitle } from '../markdown-it-plugins/markdown-it-title';

@Injectable()
export class NgxMarkdownService {
	private markdownIt: MarkdownIt;

	public constructor() {
		// init instance
		this.markdownIt = new MarkdownIt({
			breaks: true,
			linkify: true /* cspell: disable-line */,
		});

		// use plugins
		this.markdownIt.use(MarkdownItHashTag);
		this.markdownIt.use(MarkdownItMentions);
		this.markdownIt.use(MarkdownItMentionWithId);
		this.markdownIt.use(MarkdownItTitle);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.markdownIt.use(TaskList, { enabled: true });
	}

	public parse(markdown: string): string {
		return this.markdownIt.render(markdown);
	}
}
