import { async, TestBed } from '@angular/core/testing';
import { NgxMarkdownService } from './ngx-markdown.service';

describe('NgxMarkdownService', () => {
	beforeEach(() => TestBed.configureTestingModule({}));

	it('should be created', async(async () => {
		const service = TestBed.get(NgxMarkdownService) as NgxMarkdownService;
		await expect(service).toBeTruthy();
	}));
});
