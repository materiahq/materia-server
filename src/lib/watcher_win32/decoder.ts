const sd = require('string_decoder');

export class LineDecoder {
	remaining: any;
	stringDecoder: any;

	constructor(encoding = 'utf8') {
		this.stringDecoder = new sd.StringDecoder(encoding);
		this.remaining = null;
	}

	write(buffer) {
		const result = [];
		const value = this.remaining
			? this.remaining + this.stringDecoder.write(buffer)
			: this.stringDecoder.write(buffer);

		if (value.length < 1) {
			return result;
		}
		let start = 0;
		let ch;
		while (
			start < value.length &&
			((ch = value.charCodeAt(start)) === 13 || ch === 10)
		) {
			start++;
		}
		let idx = start;
		while (idx < value.length) {
			ch = value.charCodeAt(idx);
			if (ch === 13 || ch === 10) {
				result.push(value.substring(start, idx));
				idx++;
				while (
					idx < value.length &&
					((ch = value.charCodeAt(idx)) === 13 || ch === 10)
				) {
					idx++;
				}
				start = idx;
			} else {
				idx++;
			}
		}
		this.remaining = start < value.length ? value.substr(start) : null;
		return result;
	}

	end() {
		return this.remaining;
	}
}
