import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs';

export interface MentionConfig<T> {
	trigger: string;
	data: Observable<T[]>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	template?: TemplateRef<any>;
	transform?(item: T): string;
}
