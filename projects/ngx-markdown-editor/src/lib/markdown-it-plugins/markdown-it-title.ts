import MarkdownIt from 'markdown-it';
import ParserInline from 'markdown-it/lib/parser_inline';
import Renderer from 'markdown-it/lib/renderer';

export const MarkdownItTitle: MarkdownIt.PluginSimple = (md) => {
	const parserId = 'title';

	const parser: ParserInline.RuleInline = (state, silent) => {
		// get parser input
		const matches = new RegExp(/\{(.+)\|\|(.+)\}/).exec(state.src.slice(state.pos));

		if (
			// if nothing match
			!matches ||
			// check if matched string is start of input
			(matches.index > 0 && matches.input[matches.index - 1])
		) {
			return false;
		}

		// advance the cursor
		state.pos += matches[0].length;

		// no token in silent mode
		if (silent) {
			return true;
		}

		// generate token
		const token = state.push(parserId, '', 0);
		token.meta = { matches };

		return true;
	};

	const render: Renderer.RenderRule = (tokens, id) => {
		// get matches
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const matches = tokens[id].meta.matches as RegExpExecArray;
		// get matched mention
		const text = matches[1];
		const title = matches[2];
		// render result
		return `<span title="${title}">${text}</a>`;
	};

	// register parser & render
	md.inline.ruler.push(parserId, parser);
	md.renderer.rules[parserId] = render;
};
