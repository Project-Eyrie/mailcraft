// Provider information reference for displaying email provider rules in the UI
export const PROVIDER_INFO = [
	{
		name: 'Gmail',
		domains: ['gmail.com', 'googlemail.com'],
		rules: '6–30 chars, letters/numbers/dots only, dots are ignored, + aliases work'
	},
	{
		name: 'Outlook',
		domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
		rules: '1–64 chars, must start with a letter, allows dots/underscores/hyphens'
	},
	{
		name: 'Yahoo',
		domains: ['yahoo.com', 'ymail.com', 'rocketmail.com'],
		rules: '4–32 chars, must start with a letter, allows dots/underscores'
	},
	{
		name: 'iCloud',
		domains: ['icloud.com', 'me.com', 'mac.com'],
		rules: '3–20 chars, must start with a letter, allows dots/underscores/+'
	},
	{
		name: 'Proton',
		domains: ['proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me'],
		rules: '1–40 chars, allows dots/underscores/hyphens'
	},
	{
		name: 'Zoho',
		domains: ['zohomail.com', 'zoho.com'],
		rules: 'Standard email rules (RFC 5321)'
	}
];
