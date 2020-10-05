export class EditorHistory {
	public constructor(
		public readonly content: string,
		public readonly selectionStart: number,
		public readonly selectionEnd: number,
	) {}
}
