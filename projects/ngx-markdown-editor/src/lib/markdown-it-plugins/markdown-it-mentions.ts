import * as MarkdownIt from 'markdown-it';
import * as ParserInline from 'markdown-it/lib/parser_inline';
import * as Renderer from 'markdown-it/lib/renderer';

export const MarkdownItMentions: MarkdownIt.PluginSimple = (md) => {
	const parserId = 'mention';

	const parser: ParserInline.RuleInline = (state, silent) => {
		// get parser input
		const matches = new RegExp(/@([\w.\-_]+)/i).exec(state.src.slice(state.pos));

		if (
			// if nothing match
			!matches ||
			// check if matched string is start of input
			(matches.index > 0 && matches.input[matches.index - 1]) ||
			// if not separated by space or start of line
			(state.pos > 0 && state.src[state.pos - 1] !== ' ' && state.src[state.pos - 1] !== '\n')
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
		const name = matches[1];
		// render result
		return `<a href="#" data-mention-name="${name}">${`@${name}`}</a>`;
	};

	// register parser & render
	md.inline.ruler.push(parserId, parser);
	md.renderer.rules[parserId] = render;
};
