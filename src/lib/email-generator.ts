// Core email generation engine that builds possible email addresses from personal information using common naming patterns across 24 providers
export interface UserInput {
	firstName: string;
	lastName: string;
	middleName?: string;
	nickname?: string;
	birthYear?: number;
	birthMonth?: number;
	birthDay?: number;
	postcode?: string;
	customDomains?: string[];
	disabledCategories?: string[];
}

export interface CategoryInfo {
	name: string;
	example: string;
	requires?: string;
}

export const CATEGORIES: CategoryInfo[] = [
	{ name: 'Name Combinations', example: 'first.last' },
	{ name: 'Initials', example: 'flast' },
	{ name: 'Middle Name', example: 'first.m.last', requires: 'middleName' },
	{ name: 'With Year', example: 'first.last03', requires: 'birthYear' },
	{ name: 'With Birthday', example: 'first0315', requires: 'birthMonth' },
	{ name: 'Location', example: 'first10001', requires: 'postcode' },
	{ name: 'Nickname/Username', example: 'nick', requires: 'nickname' },
	{ name: 'Separators', example: 'first_last' },
	{ name: 'Simple', example: 'first' },
	{ name: 'Multi-word', example: 'first.de.last', requires: 'multiWord' },
	{ name: 'Numbers', example: 'first.last1' }
];

export interface GeneratedEmail {
	email: string;
	provider: string;
	pattern: string;
	category: string;
	score: number;
	commonality: number;
	identifiability: number;
}

interface Provider {
	domain: string;
	name: string;
	marketShare: number;
	allowsUnderscore: boolean;
	allowsHyphen: boolean;
	dotIsDistinct: boolean;
	minLength: number;
	maxLength: number;
}

const PROVIDERS: Provider[] = [
	{ domain: 'gmail.com', name: 'Gmail', marketShare: 0.75, allowsUnderscore: false, allowsHyphen: false, dotIsDistinct: false, minLength: 6, maxLength: 30 },
	{ domain: 'outlook.com', name: 'Outlook', marketShare: 0.15, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'hotmail.com', name: 'Hotmail', marketShare: 0.06, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'live.com', name: 'Live', marketShare: 0.03, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'yahoo.com', name: 'Yahoo', marketShare: 0.08, allowsUnderscore: true, allowsHyphen: false, dotIsDistinct: true, minLength: 4, maxLength: 32 },
	{ domain: 'ymail.com', name: 'Ymail', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: false, dotIsDistinct: true, minLength: 4, maxLength: 32 },
	{ domain: 'icloud.com', name: 'iCloud', marketShare: 0.04, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 3, maxLength: 20 },
	{ domain: 'me.com', name: 'me.com', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 3, maxLength: 20 },
	{ domain: 'aol.com', name: 'AOL', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: false, dotIsDistinct: true, minLength: 3, maxLength: 32 },
	{ domain: 'protonmail.com', name: 'ProtonMail', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 40 },
	{ domain: 'proton.me', name: 'Proton', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 40 },
	{ domain: 'zoho.com', name: 'Zoho', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'mail.com', name: 'Mail.com', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'gmx.com', name: 'GMX', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'bigpond.com', name: 'Bigpond', marketShare: 0.03, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'optusnet.com.au', name: 'Optusnet', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'bigpond.net.au', name: 'Bigpond', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'tpg.com.au', name: 'TPG', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'iinet.net.au', name: 'iiNet', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'qq.com', name: 'QQ', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: false, dotIsDistinct: true, minLength: 3, maxLength: 18 },
	{ domain: '163.com', name: '163', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'mail.ru', name: 'Mail.ru', marketShare: 0.02, allowsUnderscore: true, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 64 },
	{ domain: 'yandex.ru', name: 'Yandex', marketShare: 0.02, allowsUnderscore: false, allowsHyphen: true, dotIsDistinct: true, minLength: 1, maxLength: 30 },
	{ domain: 'yahoo.co.jp', name: 'Yahoo JP', marketShare: 0.01, allowsUnderscore: true, allowsHyphen: false, dotIsDistinct: true, minLength: 1, maxLength: 32 },
];

interface PatternDef {
	id: string;
	label: string;
	category: string;
	generate: (input: UserInput) => string | null;
	commonality: number;
	identifiability: number;
	requiresSeparator?: boolean;
}

// Strips non-alphabetic characters and lowercases a string for use in email local parts
function clean(s: string): string {
	return s.toLowerCase().replace(/[^a-z]/g, '');
}

// Lowercases and strips characters not valid in email local parts, preserving numbers, dots, underscores, and hyphens
function cleanUsername(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

// Builds all email pattern definitions based on available personal information fields
function buildPatterns(input: UserInput): PatternDef[] {
	const first = clean(input.firstName);
	const last = clean(input.lastName);
	const middle = input.middleName ? clean(input.middleName) : null;
	const mi = middle ? middle[0] : null;
	const nick = input.nickname ? cleanUsername(input.nickname) : null;
	const year = input.birthYear ? String(input.birthYear) : null;
	const year2 = input.birthYear ? String(input.birthYear).slice(2) : null;
	const month = input.birthMonth ? String(input.birthMonth).padStart(2, '0') : null;
	const day = input.birthDay ? String(input.birthDay).padStart(2, '0') : null;
	const postcode = input.postcode || null;

	const fi = first[0];
	const li = last[0];

	const lastWords = input.lastName.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const lastInitials = lastWords.length > 1 ? lastWords.map((w) => w[0]).join('') : null;
	const lastWordsCleaned = lastWords.length > 1 ? lastWords.map(clean) : null;

	const patterns: PatternDef[] = [];

	patterns.push({
		id: 'first.last',
		label: 'firstname.lastname',
		category: 'Name Combinations',
		generate: () => `${first}.${last}`,
		commonality: 1.0,
		identifiability: 0.95
	});

	patterns.push({
		id: 'firstlast',
		label: 'firstnamelastname',
		category: 'Name Combinations',
		generate: () => `${first}${last}`,
		commonality: 0.9,
		identifiability: 0.95
	});

	patterns.push({
		id: 'last.first',
		label: 'lastname.firstname',
		category: 'Name Combinations',
		generate: () => `${last}.${first}`,
		commonality: 0.55,
		identifiability: 0.9
	});

	patterns.push({
		id: 'lastfirst',
		label: 'lastnamefirstname',
		category: 'Name Combinations',
		generate: () => `${last}${first}`,
		commonality: 0.5,
		identifiability: 0.9
	});

	patterns.push({
		id: 'filast',
		label: 'firstinitiallastname',
		category: 'Initials',
		generate: () => `${fi}${last}`,
		commonality: 0.7,
		identifiability: 0.7
	});

	patterns.push({
		id: 'fi.last',
		label: 'firstinitial.lastname',
		category: 'Initials',
		generate: () => `${fi}.${last}`,
		commonality: 0.65,
		identifiability: 0.7
	});

	patterns.push({
		id: 'firstli',
		label: 'firstnamelastinitial',
		category: 'Initials',
		generate: () => `${first}${li}`,
		commonality: 0.6,
		identifiability: 0.65
	});

	patterns.push({
		id: 'first.li',
		label: 'firstname.lastinitial',
		category: 'Initials',
		generate: () => `${first}.${li}`,
		commonality: 0.55,
		identifiability: 0.65
	});

	patterns.push({
		id: 'fili',
		label: 'firstinitiallastinitial',
		category: 'Initials',
		generate: () => `${fi}${li}`,
		commonality: 0.3,
		identifiability: 0.3
	});

	if (mi) {
		patterns.push({
			id: 'first.mi.last',
			label: 'firstname.middleinitial.lastname',
			category: 'Middle Name',
			generate: () => `${first}.${mi}.${last}`,
			commonality: 0.7,
			identifiability: 0.98
		});

		patterns.push({
			id: 'firstmilast',
			label: 'firstnamemiddleinitiallastname',
			category: 'Middle Name',
			generate: () => `${first}${mi}${last}`,
			commonality: 0.6,
			identifiability: 0.97
		});

		patterns.push({
			id: 'fimilast',
			label: 'firstinitialmiddleinitiallastname',
			category: 'Middle Name',
			generate: () => `${fi}${mi}${last}`,
			commonality: 0.45,
			identifiability: 0.85
		});

		patterns.push({
			id: 'first.middle.last',
			label: 'firstname.middlename.lastname',
			category: 'Middle Name',
			generate: () => `${first}.${middle}.${last}`,
			commonality: 0.35,
			identifiability: 1.0
		});

		patterns.push({
			id: 'firstmiddlelast',
			label: 'firstnamemiddlenamelastname',
			category: 'Middle Name',
			generate: () => `${first}${middle}${last}`,
			commonality: 0.3,
			identifiability: 1.0
		});
	}

	if (year2) {
		patterns.push({
			id: 'first.last.yy',
			label: 'firstname.lastname + 2-digit year',
			category: 'With Year',
			generate: () => `${first}.${last}${year2}`,
			commonality: 1.0,
			identifiability: 1.0
		});

		patterns.push({
			id: 'firstlastyy',
			label: 'firstnamelastname + 2-digit year',
			category: 'With Year',
			generate: () => `${first}${last}${year2}`,
			commonality: 0.95,
			identifiability: 1.0
		});

		patterns.push({
			id: 'first.last.yyyy',
			label: 'firstname.lastname + 4-digit year',
			category: 'With Year',
			generate: () => `${first}.${last}${year}`,
			commonality: 0.85,
			identifiability: 1.0
		});

		patterns.push({
			id: 'firstlastyyyy',
			label: 'firstnamelastname + 4-digit year',
			category: 'With Year',
			generate: () => `${first}${last}${year}`,
			commonality: 0.8,
			identifiability: 1.0
		});

		patterns.push({
			id: 'filastyy',
			label: 'firstinitiallastname + 2-digit year',
			category: 'With Year',
			generate: () => `${fi}${last}${year2}`,
			commonality: 0.75,
			identifiability: 0.9
		});

		patterns.push({
			id: 'firstyy',
			label: 'firstname + 2-digit year',
			category: 'With Year',
			generate: () => `${first}${year2}`,
			commonality: 0.7,
			identifiability: 0.75
		});

		if (mi) {
			patterns.push({
				id: 'first.mi.last.yy',
				label: 'firstname.middleinitial.lastname + 2-digit year',
				category: 'With Year',
				generate: () => `${first}.${mi}.${last}${year2}`,
				commonality: 0.8,
				identifiability: 1.0
			});
		}
	}

	if (month && day) {
		const mmdd = `${month}${day}`;
		const ddmm = `${day}${month}`;

		patterns.push({
			id: 'first.last.mmdd',
			label: 'firstname.lastname + mmdd',
			category: 'With Birthday',
			generate: () => `${first}.${last}${mmdd}`,
			commonality: 0.45,
			identifiability: 0.9
		});

		patterns.push({
			id: 'firstlastmmdd',
			label: 'firstnamelastname + mmdd',
			category: 'With Birthday',
			generate: () => `${first}${last}${mmdd}`,
			commonality: 0.4,
			identifiability: 0.9
		});

		patterns.push({
			id: 'first.last.ddmm',
			label: 'firstname.lastname + ddmm',
			category: 'With Birthday',
			generate: () => `${first}.${last}${ddmm}`,
			commonality: 0.25,
			identifiability: 0.9
		});

		if (year2) {
			patterns.push({
				id: 'first.last.mmddyy',
				label: 'firstname.lastname + mmddyy',
				category: 'With Birthday',
				generate: () => `${first}.${last}${mmdd}${year2}`,
				commonality: 0.3,
				identifiability: 0.95
			});
		}
	}

	if (postcode) {
		patterns.push({
			id: 'first.last.postcode',
			label: 'firstname.lastname + postcode',
			category: 'Location',
			generate: () => `${first}.${last}${postcode}`,
			commonality: 0.35,
			identifiability: 0.8
		});

		patterns.push({
			id: 'firstlastpostcode',
			label: 'firstnamelastname + postcode',
			category: 'Location',
			generate: () => `${first}${last}${postcode}`,
			commonality: 0.3,
			identifiability: 0.8
		});
	}

	if (nick) {
		patterns.push({
			id: 'nick',
			label: 'nickname/username',
			category: 'Nickname/Username',
			generate: () => nick,
			commonality: 0.9,
			identifiability: 0.8
		});

		if (year2) {
			patterns.push({
				id: 'nickyy',
				label: 'nickname/username + 2-digit year',
				category: 'Nickname/Username',
				generate: () => `${nick}${year2}`,
				commonality: 0.8,
				identifiability: 0.85
			});

			patterns.push({
				id: 'nickyyyy',
				label: 'nickname/username + 4-digit year',
				category: 'Nickname/Username',
				generate: () => `${nick}${year}`,
				commonality: 0.65,
				identifiability: 0.85
			});
		}
	}

	patterns.push({
		id: 'first_last',
		label: 'firstname_lastname',
		category: 'Separators',
		generate: () => `${first}_${last}`,
		commonality: 0.45,
		identifiability: 0.9,
		requiresSeparator: true
	});

	patterns.push({
		id: 'first-last',
		label: 'firstname-lastname',
		category: 'Separators',
		generate: () => `${first}-${last}`,
		commonality: 0.35,
		identifiability: 0.9,
		requiresSeparator: true
	});

	patterns.push({
		id: 'last_first',
		label: 'lastname_firstname',
		category: 'Separators',
		generate: () => `${last}_${first}`,
		commonality: 0.3,
		identifiability: 0.85,
		requiresSeparator: true
	});

	if (year2) {
		patterns.push({
			id: 'first_last_yy',
			label: 'firstname_lastname + 2-digit year',
			category: 'Separators',
			generate: () => `${first}_${last}${year2}`,
			commonality: 0.35,
			identifiability: 0.8,
			requiresSeparator: true
		});
	}

	patterns.push({
		id: 'first',
		label: 'firstname only',
		category: 'Simple',
		generate: () => first,
		commonality: 0.6,
		identifiability: 0.3
	});

	patterns.push({
		id: 'last',
		label: 'lastname only',
		category: 'Simple',
		generate: () => last,
		commonality: 0.35,
		identifiability: 0.3
	});

	if (lastInitials && lastWordsCleaned) {
		patterns.push({
			id: 'first.li_initials',
			label: 'firstname + lastnameinitials',
			category: 'Multi-word',
			generate: () => `${first}${lastInitials}`,
			commonality: 0.5,
			identifiability: 0.7
		});

		patterns.push({
			id: 'first.li_initials.dot',
			label: 'firstname.lastnameinitials',
			category: 'Multi-word',
			generate: () => `${first}.${lastInitials}`,
			commonality: 0.45,
			identifiability: 0.7
		});

		if (year2) {
			patterns.push({
				id: 'first.li_initials.yy',
				label: 'firstname + lastnameinitials + 2-digit year',
				category: 'Multi-word',
				generate: () => `${first}${lastInitials}${year2}`,
				commonality: 0.55,
				identifiability: 0.85
			});

			patterns.push({
				id: 'first.li_initials.dot.yy',
				label: 'firstname.lastnameinitials + 2-digit year',
				category: 'Multi-word',
				generate: () => `${first}.${lastInitials}${year2}`,
				commonality: 0.5,
				identifiability: 0.85
			});
		}

		patterns.push({
			id: 'first_li_initials',
			label: 'firstname_lastnameinitials',
			category: 'Multi-word',
			generate: () => `${first}_${lastInitials}`,
			commonality: 0.4,
			identifiability: 0.7,
			requiresSeparator: true
		});

		if (year2) {
			patterns.push({
				id: 'first_li_initials_yy',
				label: 'firstname_lastnameinitials + 2-digit year',
				category: 'Multi-word',
				generate: () => `${first}_${lastInitials}${year2}`,
				commonality: 0.4,
				identifiability: 0.85,
				requiresSeparator: true
			});
		}

		patterns.push({
			id: 'fi.li_initials',
			label: 'firstinitial + lastnameinitials',
			category: 'Multi-word',
			generate: () => `${fi}${lastInitials}`,
			commonality: 0.3,
			identifiability: 0.45
		});

		for (const word of lastWordsCleaned) {
			if (word.length > 2) {
				patterns.push({
					id: `first.lastword_${word}`,
					label: `firstname.${word}`,
					category: 'Multi-word',
					generate: () => `${first}.${word}`,
					commonality: 0.4,
					identifiability: 0.6
				});

				patterns.push({
					id: `firstlastword_${word}`,
					label: `firstname${word}`,
					category: 'Multi-word',
					generate: () => `${first}${word}`,
					commonality: 0.35,
					identifiability: 0.6
				});

				if (year2) {
					patterns.push({
						id: `first.lastword_${word}.yy`,
						label: `firstname.${word} + 2-digit year`,
						category: 'Multi-word',
						generate: () => `${first}.${word}${year2}`,
						commonality: 0.35,
						identifiability: 0.75
					});
				}
			}
		}

		for (const word of lastWordsCleaned) {
			if (word.length > 2) {
				patterns.push({
					id: `first_lastword_${word}`,
					label: `firstname_${word}`,
					category: 'Multi-word',
					generate: () => `${first}_${word}`,
					commonality: 0.3,
					identifiability: 0.6,
					requiresSeparator: true
				});
			}
		}

		if (lastWordsCleaned.length >= 2) {
			const dottedLast = lastWordsCleaned.join('.');
			patterns.push({
				id: 'first.dotted_last',
				label: `firstname.${dottedLast}`,
				category: 'Multi-word',
				generate: () => `${first}.${dottedLast}`,
				commonality: 0.35,
				identifiability: 0.85
			});

			const underscoreLast = lastWordsCleaned.join('_');
			patterns.push({
				id: 'first_underscore_last',
				label: `firstname_${underscoreLast}`,
				category: 'Multi-word',
				generate: () => `${first}_${underscoreLast}`,
				commonality: 0.3,
				identifiability: 0.85,
				requiresSeparator: true
			});

			const hyphenLast = lastWordsCleaned.join('-');
			patterns.push({
				id: 'first.hyphen_last',
				label: `firstname.${hyphenLast}`,
				category: 'Multi-word',
				generate: () => `${first}.${hyphenLast}`,
				commonality: 0.25,
				identifiability: 0.85,
				requiresSeparator: true
			});

			if (year2) {
				patterns.push({
					id: 'first.dotted_last.yy',
					label: `firstname.${dottedLast} + 2-digit year`,
					category: 'Multi-word',
					generate: () => `${first}.${dottedLast}${year2}`,
					commonality: 0.3,
					identifiability: 0.9
				});
			}
		}
	}

	const numberSuffixes = ['1', '2', '3', '11', '12', '13', '21', '22', '23', '99', '01', '123'];

	for (const num of numberSuffixes) {
		patterns.push({
			id: `first.last.${num}`,
			label: `firstname.lastname + ${num}`,
			category: 'Numbers',
			generate: () => `${first}.${last}${num}`,
			commonality: num.length === 1 ? 0.55 : 0.35,
			identifiability: 0.85
		});

		patterns.push({
			id: `firstlast${num}`,
			label: `firstnamelastname + ${num}`,
			category: 'Numbers',
			generate: () => `${first}${last}${num}`,
			commonality: num.length === 1 ? 0.5 : 0.3,
			identifiability: 0.85
		});
	}

	if (year) {
		patterns.push({
			id: 'first.yyyy',
			label: 'firstname + 4-digit year',
			category: 'Numbers',
			generate: () => `${first}${year}`,
			commonality: 0.5,
			identifiability: 0.7
		});

		patterns.push({
			id: 'last.yyyy',
			label: 'lastname + 4-digit year',
			category: 'Numbers',
			generate: () => `${last}${year}`,
			commonality: 0.35,
			identifiability: 0.65
		});

		patterns.push({
			id: 'last.yy',
			label: 'lastname + 2-digit year',
			category: 'Numbers',
			generate: () => `${last}${year2}`,
			commonality: 0.4,
			identifiability: 0.6
		});
	}

	return patterns;
}

// Checks if a username meets a provider's length, character, and format constraints
function isValidForProvider(username: string, provider: Provider): boolean {
	if (username.length < provider.minLength || username.length > provider.maxLength) {
		return false;
	}
	if (!provider.allowsUnderscore && username.includes('_')) {
		return false;
	}
	if (!provider.allowsHyphen && username.includes('-')) {
		return false;
	}
	if (provider.domain === 'gmail.com' && !/^[a-z0-9.]+$/.test(username)) {
		return false;
	}
	if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
		return false;
	}
	return true;
}

// Converts a wildcard pattern (* for any chars, _ for single char) into a regex string
function wildcardToRegex(pattern: string): string {
	let regex = '^';
	for (const char of pattern) {
		if (char === '*') regex += '.*';
		else if (char === '_') regex += '.';
		else regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	regex += '$';
	return regex;
}

// Matches an email against a wildcard query pattern, supporting local-part and domain matching
export function matchesQuery(email: string, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;

	const emailLower = email.toLowerCase();
	const emailAtIdx = emailLower.indexOf('@');
	if (emailAtIdx === -1) return false;

	const emailLocal = emailLower.substring(0, emailAtIdx);
	const emailDomain = emailLower.substring(emailAtIdx + 1);

	const queryAtIdx = q.indexOf('@');
	if (queryAtIdx === -1) {
		try {
			return new RegExp(wildcardToRegex(q)).test(emailLocal);
		} catch {
			return emailLocal.includes(q);
		}
	}

	const localPattern = q.substring(0, queryAtIdx);
	const domainPattern = q.substring(queryAtIdx + 1);

	let localOk = true;
	if (localPattern) {
		try {
			localOk = new RegExp(wildcardToRegex(localPattern)).test(emailLocal);
		} catch {
			localOk = emailLocal.includes(localPattern);
		}
	}

	let domainOk = true;
	if (domainPattern && domainPattern !== '*') {
		try {
			domainOk = new RegExp(wildcardToRegex(domainPattern)).test(emailDomain);
		} catch {
			domainOk = emailDomain === domainPattern;
		}
	}

	return localOk && domainOk;
}

// Generates all possible email addresses by combining patterns with providers, scoring and deduplicating results
export function generateEmails(input: UserInput): GeneratedEmail[] {
	const allPatterns = buildPatterns(input);
	const disabled = new Set(input.disabledCategories ?? []);
	const patterns = disabled.size > 0 ? allPatterns.filter((p) => !disabled.has(p.category)) : allPatterns;
	const results: GeneratedEmail[] = [];
	const seen = new Set<string>();

	const allProviders: Provider[] = [...PROVIDERS];
	if (input.customDomains) {
		for (const domain of input.customDomains) {
			const d = domain.trim().toLowerCase();
			if (d && !allProviders.some((p) => p.domain === d)) {
				allProviders.push({
					domain: d,
					name: d,
					marketShare: 0.05,
					allowsUnderscore: true,
					allowsHyphen: true,
					dotIsDistinct: true,
					minLength: 1,
					maxLength: 64
				});
			}
		}
	}

	for (const provider of allProviders) {
		for (const pattern of patterns) {
			const username = pattern.generate(input);
			if (!username) continue;
			if (!isValidForProvider(username, provider)) continue;

			const email = `${username}@${provider.domain}`;

			if (seen.has(email)) continue;
			seen.add(email);

			let piiBonus = 0;
			if (input.middleName && pattern.category === 'Middle Name') piiBonus += 0.15;
			if (input.birthYear && pattern.category === 'With Year') piiBonus += 0.1;
			if ((input.birthMonth && input.birthDay) && pattern.category === 'With Birthday') piiBonus += 0.1;
			if (input.nickname && pattern.category === 'Nickname/Username') piiBonus += 0.1;

			const score =
				pattern.commonality * 0.35 +
				pattern.identifiability * 0.45 +
				provider.marketShare * 0.2 +
				piiBonus;

			results.push({
				email,
				provider: provider.name,
				pattern: pattern.label,
				category: pattern.category,
				score: Math.round(score * 100) / 100,
				commonality: pattern.commonality,
				identifiability: pattern.identifiability
			});
		}
	}

	results.sort((a, b) => b.score - a.score);

	return results;
}
