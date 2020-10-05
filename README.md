[![npm version](https://badge.fury.io/js/%40ymchun%2Fngx-markdown-editor.svg)](https://badge.fury.io/js/%40ymchun%2Fngx-markdown-editor)
[![Build Status](https://travis-ci.com/ymchun/ngx-markdown-editor.svg?branch=master)](https://travis-ci.com/ymchun/ngx-markdown-editor)
[![Known Vulnerabilities](https://snyk.io/test/github/ymchun/ngx-markdown-editor/badge.svg?targetFile=projects/ngx-markdown-editor/package.json)](https://snyk.io/test/github/ymchun/ngx-markdown-editor?targetFile=projects/ngx-markdown-editor/package.json)

# @ymchun/ngx-markdown-editor
A simple markdown editor component for Angular 2 and up.

# Demo
[Stackblitz](https://ngx-markdown-editor-demo.stackblitz.io)

# Dependencies

* [markdown-it-task-lists](https://www.npmjs.com/package/markdown-it-task-lists)
* [markdown-it](https://www.npmjs.com/package/markdown-it)

# Install

Using npm

```
npm install @ymchun/ngx-markdown-editor
```

Import to your module

```typescript
import { NgxMarkdownEditorModule } from '@ymchun/ngx-markdown-editor';

@NgModule({
  imports: [
    NgxMarkdownEditorModule, // <-- import the library into your module
  ],
})
export class AppModule {}
```

# Usage

### Using the editor

```html
<ngx-markdown-editor name="markdown" [(ngModel)]="markdown" (files)="upload($event)" (mentionSearchTerm)="search($event)"></ngx-markdown-editor>
```

### Using the markdown viewer

```html
<iframe ngxMarkdownViewer [markdown]="markdown" (ready)="ready()" (mentions)="mentions($event)" (tags)="tags($event)" (taskLists)="taskLists($event)"></iframe>
```

### Using the markdown text preview pipe

```html
<div>{{ markdown | ngxMarkdownTextPreview }}</div>
```

### Using the markdown service

```typescript
import { NgxMarkdownEditorService } from '@ymchun/ngx-markdown-editor';

@Component({
  ...
})
export class DemoComponent {

  public constructor(private ngxMarkdownEditorService: NgxMarkdownEditorService) {}

  public parseMarkdown(markdown: string): string {
    return this.ngxMarkdownEditorService.parse(markdown);
  }

}
```

# Configuration

### NgxMarkdownEditorComponent
Type   | Name              | DataType        | Default Value | Description
-------|-------------------|-----------------|---------------|-------------
Input  | height            | string          | `'400px'`     | Define the total height of the editor element including the toolbar
Input  | historySteps      | number          | `10`          | Define the number of history saved, `0` for disable
Input  | mentionConfigs    | MentionConfig[] | `[]`          | Define mention configs
Input  | placeholder       | string          | `''`          | Define the placeholder of the editor
Input  | resize            | boolean         | `true`        | Whether allow user to resize this editor
Output | files             | File[]          | `Nil`         | Emit when files are dropped / pasted into the editor
Output | mentionSearchTerm | string          | `Nil`         | Emit when user type mention search term

### NgxMarkdownViewerDirective
Type   | Name           | DataType                | Default Value | Description
-------|----------------|-------------------------|---------------|-------------
Input  | markdown       | string                  | `undefined`   | Define the input markdown
Input  | styles         | string                  | `undefined`   | Define the additional css styles
Input  | getTagUrl      | (tag: string) => string | `undefined`   | Define the function for the link of `#tag`
Output | mentions       | string                  | `Nil`         | Emit the mention when clicked, which is `username`
Output | mentionWithIds | [ string, string ]      | `Nil`         | Emit the mention when clicked, the first string is `userId`, the second is `username`
Output | ready          | boolean                 | `Nil`         | Emit when markdown content has loaded
Output | tags           | string                  | `Nil`         | Emit the tag string when clicked
Output | taskLists      | string                  | `Nil`         | Emit the updated markdown when clicked task list checkbox

**For the `mentions`, the accepted formats are `@(userId|user.name)` or `@user.name`.**

### MentionConfig\<T\>
Name      | DataType            | Description
----------|---------------------|-------------
data      | Observable<T[]>     | Array of data entries feed into mention menu
template  | TemplateRef<any>    | Template for render mention menu entry
transform | (item: T) => string | Transform function used before inserting content to editor
trigger   | string              | Character for trigger mention menu

### MentionsSearchTerm
Name    | DataType | Description
--------|----------|-------------
term    | string   | User input search term
trigger | string   | Trigger character
