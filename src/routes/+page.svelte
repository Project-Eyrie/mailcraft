<!-- Main application page with email generation, search/filter, verification, and results display -->
<script lang="ts">
	import { browser } from '$app/environment';
	import {
		generateEmails,
		matchesQuery,
		CATEGORIES,
		type GeneratedEmail,
		type UserInput
	} from '$lib/email-generator';
	import { PROVIDER_INFO } from '$lib/validation';

	let query = $state('');

	const QUICK_DOMAINS = [
		'gmail.com',
		'outlook.com',
		'hotmail.com',
		'live.com',
		'yahoo.com',
		'ymail.com',
		'icloud.com',
		'me.com',
		'aol.com',
		'protonmail.com',
		'proton.me',
		'zoho.com',
		'mail.com',
		'gmx.com'
	];

	const AU_DOMAINS = [
		'bigpond.com',
		'optusnet.com.au',
		'bigpond.net.au',
		'tpg.com.au',
		'iinet.net.au'
	];

	const GLOBAL_DOMAINS = [
		'qq.com',
		'163.com',
		'mail.ru',
		'yandex.ru',
		'yahoo.co.jp'
	];

	let showGlobalDomains = $state(false);

	let customDomainInput = $state('');
	let customDomains = $state<string[]>([]);

	let firstName = $state('');
	let lastName = $state('');
	let middleName = $state('');
	let nickname = $state('');
	let birthYear = $state('');
	let birthMonth = $state('');
	let birthDay = $state('');
	let postcode = $state('');
	let showMore = $state(false);

	let providerFilter = $state('all');
	let showReference = $state(false);
	let selectedEmail = $state<string | null>(null);
	let showDomains = $state(false);
	let disabledCategories = $state<Set<string>>(new Set());

	interface VerifyResult {
		email: string;
		verdict: string;
		confidence: number;
		layers: {
			syntax: { valid: boolean; error?: string };
			mx: { valid: boolean };
			disposable: { isDisposable: boolean };
			provider?: {
				method: string;
				exists: boolean;
				throttled?: boolean;
				meta?: Record<string, unknown>;
			};
			signals: {
				gravatar: boolean;
				microsoft: { found: boolean; throttled?: boolean };
				spotify: { found: boolean };
				xposedOrNot: { found: boolean; breaches?: string[] };
				leakCheck: { found: boolean; sources?: string[] };
			};
		};
	}

	let verificationResults = $state<Record<string, VerifyResult>>({});
	let verifying = $state(false);
	let verifyProgress = $state({ done: 0, total: 0 });
	let verifyingSingle = $state('');

	// Reads URL query parameters to restore application state on page load
	function initFromURL() {
		if (!browser) return;
		const p = new URLSearchParams(window.location.search);
		if (p.get('fn')) firstName = p.get('fn')!;
		if (p.get('ln')) lastName = p.get('ln')!;
		if (p.get('mn')) { middleName = p.get('mn')!; showMore = true; }
		if (p.get('nick')) { nickname = p.get('nick')!; showMore = true; }
		if (p.get('y')) birthYear = p.get('y')!;
		if (p.get('m')) { birthMonth = p.get('m')!; showMore = true; }
		if (p.get('d')) { birthDay = p.get('d')!; showMore = true; }
		if (p.get('pc')) { postcode = p.get('pc')!; showMore = true; }
		if (p.get('q')) query = p.get('q')!;
		if (p.get('cd')) {
			customDomains = p.get('cd')!.split(',').filter(Boolean);
			if (customDomains.length > 0) showDomains = true;
		}
	}

	initFromURL();

	// Syncs current application state to URL query parameters for shareable links
	function updateURL() {
		if (!browser) return;
		const p = new URLSearchParams();
		if (firstName.trim()) p.set('fn', firstName.trim());
		if (lastName.trim()) p.set('ln', lastName.trim());
		if (middleName.trim()) p.set('mn', middleName.trim());
		if (nickname.trim()) p.set('nick', nickname.trim());
		if (birthYear.trim()) p.set('y', birthYear.trim());
		if (birthMonth.trim()) p.set('m', birthMonth.trim());
		if (birthDay.trim()) p.set('d', birthDay.trim());
		if (postcode.trim()) p.set('pc', postcode.trim());
		if (query.trim()) p.set('q', query.trim());
		if (customDomains.length > 0) p.set('cd', customDomains.join(','));
		const qs = p.toString();
		const newUrl = qs ? `?${qs}` : window.location.pathname;
		window.history.replaceState({}, '', newUrl);
	}

	$effect(() => {
		firstName; lastName; middleName; nickname;
		birthYear; birthMonth; birthDay; postcode;
		query; customDomains;
		updateURL();
	});

	let shareLink = $state('');

	// Copies the current URL with state to the clipboard for sharing
	function copyShareLink() {
		if (!browser) return;
		updateURL();
		navigator.clipboard.writeText(window.location.href).then(() => {
			shareLink = 'copied!';
			setTimeout(() => (shareLink = ''), 2000);
		});
	}

	let allGenerated = $derived.by((): GeneratedEmail[] => {
		if (!firstName.trim() || !lastName.trim()) return [];

		const input: UserInput = {
			firstName: firstName.trim(),
			lastName: lastName.trim()
		};

		if (middleName.trim()) input.middleName = middleName.trim();
		if (nickname.trim()) input.nickname = nickname.trim();
		if (birthYear.trim()) input.birthYear = parseInt(birthYear.trim());
		if (birthMonth.trim()) input.birthMonth = parseInt(birthMonth.trim());
		if (birthDay.trim()) input.birthDay = parseInt(birthDay.trim());
		if (postcode.trim()) input.postcode = postcode.trim();
		if (customDomains.length > 0) input.customDomains = customDomains;
		if (disabledCategories.size > 0) input.disabledCategories = [...disabledCategories];

		return generateEmails(input);
	});

	let suggestions = $derived.by((): GeneratedEmail[] => {
		const q = query.trim().toLowerCase();
		if (!q) return allGenerated;
		return allGenerated.filter((r) => matchesQuery(r.email, q));
	});

	let filteredSuggestions = $derived(
		providerFilter === 'all'
			? suggestions
			: suggestions.filter((r) => r.provider === providerFilter)
	);

	let manualEmail = $derived.by((): GeneratedEmail | null => {
		const q = query.trim().toLowerCase();
		if (!q.includes('@')) return null;
		if (q.includes('*') || q.includes('_')) return null;
		if (!/^[a-z0-9.+_-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(q)) return null;
		if (filteredSuggestions.some((r) => r.email === q)) return null;
		const atIdx = q.indexOf('@');
		const domain = q.substring(atIdx + 1);
		return {
			email: q,
			provider: domain,
			pattern: 'manual entry',
			category: 'Manual',
			score: 0,
			commonality: 0,
			identifiability: 0
		};
	});

	let displaySuggestions = $derived(
		manualEmail ? [manualEmail, ...filteredSuggestions] : filteredSuggestions
	);

	let providers = $derived([...new Set(suggestions.map((r) => r.provider))]);

	let selectedResult = $derived(
		selectedEmail ? displaySuggestions.find((r) => r.email === selectedEmail) ?? null : null
	);

	let selectedVerification = $derived(
		selectedEmail ? verificationResults[selectedEmail] ?? null : null
	);

	// Checks if an email has been found in any breach or leak databases
	function hasLeaks(email: string): boolean {
		const v = verificationResults[email];
		if (!v) return false;
		return v.layers.signals.xposedOrNot.found || v.layers.signals.leakCheck.found;
	}

	// Checks if an email has been confirmed to exist by provider-level verification
	function isConfirmed(email: string): boolean {
		const v = verificationResults[email];
		if (!v) return false;
		return v.verdict === 'valid' || v.layers.provider?.exists === true;
	}

	// Toggles the selected email in the detail sidebar
	function selectEmail(email: string) {
		selectedEmail = selectedEmail === email ? null : email;
	}

	let queryIsComplete = $derived.by(() => {
		const q = query.trim();
		if (!q.includes('@')) return false;
		if (q.includes('*') || q.includes('_')) return false;
		return /^[a-z0-9.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(q);
	});

	let hasWildcards = $derived(query.includes('*') || query.includes('_'));

	type SegmentType = 'literal' | 'wildcard' | 'at' | 'domain';

	let patternSegments = $derived.by((): { char: string; type: SegmentType }[] => {
		const q = query;
		if (!q) return [];
		const atIdx = q.indexOf('@');
		return [...q].map((char, i) => {
			if (char === '@') return { char, type: 'at' as SegmentType };
			if (atIdx >= 0 && i > atIdx) return { char, type: 'domain' as SegmentType };
			if (char === '*' || char === '_') return { char, type: 'wildcard' as SegmentType };
			return { char, type: 'literal' as SegmentType };
		});
	});

	// Returns the Gravatar image URL for a given email address
	function gravatarUrl(email: string): string {
		return `https://www.gravatar.com/avatar/${md5(email.trim().toLowerCase())}?s=32&d=404`;
	}

	// Computes an MD5 hash of a string for Gravatar URL generation
	function md5(str: string): string {
		// Processes a 64-byte block through the four MD5 rounds
		function md5cycle(x: number[], k: number[]) {
			let a = x[0], b = x[1], c = x[2], d = x[3];
			a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
			a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
			a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
			a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
			a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
			a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
			a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
			a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
			a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
			a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
			a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
			a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
			a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
			a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
			a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
			a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
			x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
		}
		// Performs the common MD5 rotate-and-add operation
		function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
		// MD5 round 1 auxiliary function
		function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
		// MD5 round 2 auxiliary function
		function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
		// MD5 round 3 auxiliary function
		function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
		// MD5 round 4 auxiliary function
		function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
		// Adds two 32-bit integers with overflow wrapping
		function add32(a: number, b: number) { return (a + b) & 0xffffffff; }

		const n = str.length;
		let state = [1732584193, -271733879, -1732584194, 271733878];
		let i: number;
		for (i = 64; i <= n; i += 64) {
			const k: number[] = [];
			for (let j = i - 64; j < i; j += 4) k.push(str.charCodeAt(j) | (str.charCodeAt(j+1) << 8) | (str.charCodeAt(j+2) << 16) | (str.charCodeAt(j+3) << 24));
			md5cycle(state, k);
		}
		const tail: number[] = [];
		for (let j = i - 64; j < n; j++) tail.push(str.charCodeAt(j));
		tail.push(0x80);
		while (tail.length < (tail.length <= 56 ? 56 : 120)) tail.push(0);
		const k: number[] = [];
		for (let j = 0; j < tail.length; j += 4) k.push((tail[j] || 0) | ((tail[j+1] || 0) << 8) | ((tail[j+2] || 0) << 16) | ((tail[j+3] || 0) << 24));
		k.push(n * 8); k.push(0);
		while (k.length % 16 !== 0) k.push(0);
		for (let j = 0; j < k.length; j += 16) md5cycle(state, k.slice(j, j + 16));
		const hex = '0123456789abcdef';
		let s = '';
		for (const v of state) for (let j = 0; j < 4; j++) s += hex[(v >> (j * 8 + 4)) & 0xf] + hex[(v >> (j * 8)) & 0xf];
		return s;
	}

	// Toggles a pattern category on or off for email generation filtering
	function toggleCategory(cat: string) {
		const next = new Set(disabledCategories);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		disabledCategories = next;
	}

	// Adds a user-entered custom domain to the generation list
	function addCustomDomain() {
		const d = customDomainInput.trim().toLowerCase();
		if (d && !customDomains.includes(d) && d.includes('.')) {
			customDomains = [...customDomains, d];
			customDomainInput = '';
		}
	}

	// Removes a custom domain from the generation list
	function removeCustomDomain(domain: string) {
		customDomains = customDomains.filter((d) => d !== domain);
	}

	// Appends or replaces the domain portion of the search query
	function appendDomain(domain: string) {
		const q = query.trim();
		const atIdx = q.indexOf('@');
		if (atIdx >= 0) {
			query = q.substring(0, atIdx + 1) + domain;
		} else {
			query = q + '@' + domain;
		}
	}

	// Verifies the email currently typed in the query input
	async function handleVerifyQuery() {
		if (!queryIsComplete) return;
		await handleVerifySingle(query.trim().toLowerCase());
	}

	let verifyAbort = $state<AbortController | null>(null);

	// Verifies the top 10 unverified emails in the current results
	async function handleVerifyTop() {
		if (displaySuggestions.length === 0) return;
		verifying = true;

		const emails = displaySuggestions
			.filter((r) => !verificationResults[r.email])
			.slice(0, 10)
			.map((r) => r.email);

		verifyProgress = { done: 0, total: emails.length };

		for (const email of emails) {
			verifyingSingle = email;
			try {
				const res = await fetch('/api/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ emails: [email] })
				});

				if (res.ok) {
					const data = await res.json();
					if (data.results?.[0]) {
						verificationResults = { ...verificationResults, [email]: data.results[0] };
					}
				}
			} catch {
			}
			verifyProgress = { done: verifyProgress.done + 1, total: emails.length };
		}

		verifyingSingle = '';
		verifying = false;
	}

	// Verifies all unverified emails in the current results with abort support
	async function handleVerifyAll() {
		if (displaySuggestions.length === 0) return;
		const controller = new AbortController();
		verifyAbort = controller;
		verifying = true;

		const emails = displaySuggestions
			.filter((r) => !verificationResults[r.email])
			.map((r) => r.email);

		verifyProgress = { done: 0, total: emails.length };

		for (const email of emails) {
			if (controller.signal.aborted) break;
			verifyingSingle = email;
			try {
				const res = await fetch('/api/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ emails: [email] }),
					signal: controller.signal
				});

				if (res.ok) {
					const data = await res.json();
					if (data.results?.[0]) {
						verificationResults = { ...verificationResults, [email]: data.results[0] };
					}
				}
			} catch {
				if (controller.signal.aborted) break;
			}
			verifyProgress = { done: verifyProgress.done + 1, total: emails.length };
			if (!controller.signal.aborted) {
				await new Promise((r) => setTimeout(r, 500));
			}
		}

		verifyingSingle = '';
		verifying = false;
		verifyAbort = null;
	}

	// Aborts an in-progress bulk verification operation
	function cancelVerify() {
		verifyAbort?.abort();
		verifyAbort = null;
		verifyingSingle = '';
		verifying = false;
	}

	// Verifies a single email address through the verification API
	async function handleVerifySingle(email: string) {
		verifyingSingle = email;
		try {
			const res = await fetch('/api/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ emails: [email] })
			});

			if (res.ok) {
				const data = await res.json();
				if (data.results?.[0]) {
					verificationResults = { ...verificationResults, [email]: data.results[0] };
				}
			}
		} catch {
		}
		verifyingSingle = '';
	}

	let copied = $state(false);

	// Copies all displayed email addresses to the clipboard
	function copyAllEmails() {
		const text = displaySuggestions.map((r) => r.email).join('\n');
		navigator.clipboard.writeText(text).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	// Downloads all displayed results as a CSV file
	function downloadCSV() {
		const header = 'email,provider,pattern,category,score,commonality,identifiability';
		const rows = displaySuggestions.map((r) => {
			return `${r.email},${r.provider},"${r.pattern}",${r.category},${r.score},${r.commonality},${r.identifiability}`;
		});
		const csv = [header, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `emails-${firstName.trim() || 'export'}-${lastName.trim() || ''}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Converts a verdict string to a display label
	function verdictLabel(verdict: string): string {
		switch (verdict) {
			case 'valid':
				return 'EXISTS';
			case 'invalid':
				return 'INVALID';
			case 'likely_valid':
				return 'LIKELY';
			default:
				return 'UNKNOWN';
		}
	}

	// Returns Tailwind CSS classes for styling a verdict badge
	function verdictStyle(verdict: string): string {
		switch (verdict) {
			case 'valid':
				return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300/80';
			case 'invalid':
				return 'border-zinc-700/50 bg-zinc-800/50 text-zinc-500';
			case 'likely_valid':
				return 'border-zinc-500/40 bg-zinc-700/30 text-zinc-300';
			default:
				return 'border-zinc-700 bg-zinc-800/50 text-zinc-500';
		}
	}

</script>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>

	<div class="mx-auto max-w-5xl px-4 py-8 sm:py-12">

		<div class="mb-8 text-center">
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
				<span class="text-zinc-400">mail</span><span class="text-white">craft</span>
			</h1>
			<p class="mt-2 text-sm text-zinc-500">
				generate possible emails from common patterns and perform basic checks
			</p>
			{#if firstName.trim() && lastName.trim()}
				<button
					onclick={copyShareLink}
					class="mt-2 rounded-lg bg-zinc-800/50 px-3 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-zinc-700/50 hover:text-zinc-300"
				>
					{shareLink || 'share link'}
				</button>
			{/if}
		</div>

		<div class="elevation-2 card-transition mb-5 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-5 pb-5 pt-4 sm:px-6">

			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="h-3 w-0.5 rounded-full bg-blue-500/50"></div>
					<span class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">search &amp; filter</span>
				</div>
				{#if allGenerated.length > 0}
					<span class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
						{suggestions.length}/{allGenerated.length}
					</span>
				{/if}
			</div>

			<p class="mb-3 text-[11px] leading-relaxed text-zinc-500">
				filter results with wildcards (<code class="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-300">*</code> any chars, <code class="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-300">_</code> single char) or type a full address to test it directly.
			</p>

			<div
				class="flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-950/80 px-4 py-3 transition-all focus-within:border-blue-500/30 sm:px-5 sm:py-4"
			>
				<span class="text-blue-500/40 text-sm">@</span>
				<input
					type="text"
					bind:value={query}
					placeholder={firstName.trim() && lastName.trim() ? `${firstName.trim().charAt(0).toLowerCase()}*@gmail.com` : 'john.doe@gmail.com'}
					class="flex-1 bg-transparent font-mono text-lg tracking-wide text-white placeholder-zinc-700 outline-none sm:text-xl"
				/>
				{#if queryIsComplete}
					{@const v = verificationResults[query.trim().toLowerCase()]}
					{#if v}
						<span
							class="shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold {verdictStyle(v.verdict)}"
						>
							{verdictLabel(v.verdict)}
						</span>
					{:else if verifyingSingle === query.trim().toLowerCase()}
						<span class="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></span>
					{:else}
						<button
							onclick={handleVerifyQuery}
							class="shrink-0 rounded-lg bg-zinc-700/50 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-600/50 hover:text-white"
						>
							test
						</button>
					{/if}
				{/if}
				{#if query}
					<button
						onclick={() => (query = '')}
						class="rounded-md px-1.5 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
					>
						clear
					</button>
				{/if}
			</div>

			<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">
				<span><code class="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-300">*</code> any chars</span>
				<span><code class="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-300">_</code> single char</span>
				<span class="text-zinc-800">|</span>
				<button
					onclick={() => (showDomains = !showDomains)}
					class="text-zinc-300/60 transition-colors hover:text-zinc-300"
				>
					{showDomains ? '- hide' : '+'} domains
				</button>
			</div>

			{#if query.includes('@')}
				<div class="mt-2.5 flex flex-wrap items-center gap-px">
					{#each patternSegments as seg}
						<span
							class="inline-flex h-7 min-w-[1ch] items-center justify-center px-0.5 text-base
								{seg.type === 'literal' ? (hasWildcards ? 'rounded bg-zinc-800/80 text-white' : 'text-zinc-400') : ''}
								{seg.type === 'wildcard' ? 'text-zinc-300' : ''}
								{seg.type === 'at' ? 'mx-0.5 text-zinc-600' : ''}
								{seg.type === 'domain' ? 'text-blue-400/60' : ''}"
						>
							{seg.char}
						</span>
					{/each}
				</div>
			{/if}

			{#if showDomains}
				<div class="mt-3 flex flex-wrap items-center gap-1.5">
					{#each QUICK_DOMAINS as domain}
						<button
							onclick={() => appendDomain(domain)}
							class="rounded-lg border border-zinc-800/80 bg-zinc-800/30 px-2 py-1 text-[10px] text-blue-400/50 transition-all hover:border-blue-500/30 hover:bg-zinc-700/30 hover:text-blue-300/70"
						>
							{domain}
						</button>
					{/each}
				</div>
				<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
					<span class="text-[9px] font-medium text-zinc-600 uppercase tracking-wider">au</span>
					{#each AU_DOMAINS as domain}
						<button
							onclick={() => appendDomain(domain)}
							class="rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-2 py-1 text-[10px] text-zinc-500 transition-all hover:border-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-300"
						>
							{domain}
						</button>
					{/each}
					<span class="text-zinc-800">|</span>
					<button
						onclick={() => (showGlobalDomains = !showGlobalDomains)}
						class="text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
					>
						{showGlobalDomains ? '- global' : '+ global'}
					</button>
					{#if showGlobalDomains}
						{#each GLOBAL_DOMAINS as domain}
							<button
								onclick={() => appendDomain(domain)}
								class="rounded-lg border border-zinc-800/80 bg-zinc-800/30 px-2 py-1 text-[10px] text-zinc-500 transition-all hover:border-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-300"
							>
								{domain}
							</button>
						{/each}
					{/if}
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-1.5">
					<input
						type="text"
						bind:value={customDomainInput}
						placeholder="custom domain"
						onkeydown={(e) => { if (e.key === 'Enter') addCustomDomain(); }}
						class="w-28 rounded-lg border border-zinc-700/60 bg-zinc-950/60 px-2.5 py-1 text-[10px] text-zinc-300 placeholder-zinc-700 outline-none transition-all focus:border-zinc-400/40"
					/>
					<button
						onclick={addCustomDomain}
						class="rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-2 py-1 text-[10px] text-zinc-400 transition-all hover:border-zinc-400/30 hover:text-zinc-300"
					>
						+ add
					</button>
					{#each customDomains as domain}
						<span class="inline-flex items-center gap-1 rounded-lg border border-zinc-600/40 bg-zinc-800/40 px-2 py-1 text-[10px] text-zinc-300">
							{domain}
							<button
								onclick={() => removeCustomDomain(domain)}
								class="text-zinc-300/50 transition-colors hover:text-white"
							>
								&times;
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<div class="mt-4 border-t border-zinc-800/50 pt-4">
				<div class="mb-3 flex items-center gap-2">
					<div class="h-3 w-0.5 rounded-full bg-violet-500/50"></div>
					<span class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">person details</span>
					<span class="text-[10px] text-zinc-700">&mdash; fill in to generate emails</span>
				</div>
				<div class="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
					<div class="col-span-1 sm:col-span-2">
						<label for="firstName" class="mb-1 block text-[9px] font-medium text-zinc-500">first <span class="text-zinc-500">*</span></label>
						<input
							id="firstName"
							type="text"
							bind:value={firstName}
							placeholder="john"
							class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
						/>
					</div>
					<div class="col-span-1 sm:col-span-2">
						<label for="lastName" class="mb-1 block text-[9px] font-medium text-zinc-500">last <span class="text-zinc-500">*</span></label>
						<input
							id="lastName"
							type="text"
							bind:value={lastName}
							placeholder="doe"
							class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
						/>
					</div>
					<div>
						<label for="birthYear" class="mb-1 block text-[9px] font-medium text-zinc-500">year</label>
						<input
							id="birthYear"
							type="text"
							bind:value={birthYear}
							placeholder="2003"
							maxlength="4"
							class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
						/>
					</div>
					<div>
						<span class="mb-1 block text-[9px] text-transparent select-none" aria-hidden="true">&nbsp;</span>
						<button
							onclick={() => (showMore = !showMore)}
							class="w-full rounded-lg border border-zinc-700/40 bg-zinc-800/20 px-2.5 py-1.5 text-[10px] text-zinc-500 transition-all hover:border-zinc-400/30 hover:text-zinc-300"
						>
							{showMore ? '- less' : '+ more'}
						</button>
					</div>
				</div>

				{#if showMore}
					<div class="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
						<div class="col-span-1 sm:col-span-2">
							<label for="middleName" class="mb-1 block text-[9px] font-medium text-zinc-500">middle</label>
							<input
								id="middleName"
								type="text"
								bind:value={middleName}
								placeholder="andrew"
								class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
							/>
						</div>
						<div class="col-span-1 sm:col-span-2">
							<label for="nickname" class="mb-1 block text-[9px] font-medium text-zinc-500">nickname</label>
							<input
								id="nickname"
								type="text"
								bind:value={nickname}
								placeholder="johnny"
								class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
							/>
						</div>
						<div>
							<label for="postcode" class="mb-1 block text-[9px] font-medium text-zinc-500">postcode</label>
							<input
								id="postcode"
								type="text"
								bind:value={postcode}
								placeholder="10001"
								maxlength="10"
								class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
							/>
						</div>
						<div>
							<label for="birthMonth" class="mb-1 block text-[9px] font-medium text-zinc-500">month</label>
							<input
								id="birthMonth"
								type="text"
								bind:value={birthMonth}
								placeholder="03"
								maxlength="2"
								class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
							/>
						</div>
						<div>
							<label for="birthDay" class="mb-1 block text-[9px] font-medium text-zinc-500">day</label>
							<input
								id="birthDay"
								type="text"
								bind:value={birthDay}
								placeholder="15"
								maxlength="2"
								class="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-zinc-400/50 focus:bg-zinc-800/60"
							/>
						</div>
					</div>
				{/if}
			</div>

			{#if firstName.trim() && lastName.trim()}
				<div class="mt-4 border-t border-zinc-800/50 pt-4">
					<div class="mb-2.5 flex items-center gap-2">
						<div class="h-3 w-0.5 rounded-full bg-amber-500/50"></div>
						<span class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">patterns</span>
						{#if disabledCategories.size > 0}
							<span class="text-[10px] text-zinc-600">{disabledCategories.size} off</span>
							<button
								onclick={() => (disabledCategories = new Set())}
								class="text-[10px] text-zinc-300/60 transition-colors hover:text-zinc-300"
							>
								reset
							</button>
						{/if}
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each CATEGORIES as cat}
							{@const off = disabledCategories.has(cat.name)}
							{@const needsData = cat.requires === 'middleName' ? !middleName.trim()
								: cat.requires === 'birthYear' ? !birthYear.trim()
								: cat.requires === 'birthMonth' ? !birthMonth.trim()
								: cat.requires === 'postcode' ? !postcode.trim()
								: cat.requires === 'nickname' ? !nickname.trim()
								: cat.requires === 'multiWord' ? !lastName.trim().includes(' ')
								: false}
							<button
								onclick={() => toggleCategory(cat.name)}
								class="group/cat flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] transition-all
									{off
									? 'border-zinc-800/40 bg-zinc-900/30 opacity-40 hover:opacity-60'
									: needsData
									? 'border-zinc-800/50 bg-zinc-900/40 text-zinc-600 hover:border-zinc-700'
									: 'border-zinc-600/40 bg-zinc-800/40 hover:bg-zinc-700/40'}"
							>
								<code class="font-mono {off ? 'text-zinc-700 line-through' : needsData ? 'text-zinc-600' : 'text-zinc-200'}">{cat.example}</code>
								<span class="text-zinc-600 {off ? 'line-through' : ''}">{cat.name}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if allGenerated.length > 0 || manualEmail}
		<div class="elevation-2 card-transition mb-5 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/50">
				<div>
					<div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/50 bg-zinc-900/80 px-4 py-3">
						<div class="flex items-center gap-3">
							<span class="text-[10px] font-medium text-zinc-400">
								<span class="text-zinc-300">{displaySuggestions.length}</span> results
							</span>
							{#if displaySuggestions.length > 0}
								{#if verifying}
								<div class="flex items-center gap-1.5 rounded-lg bg-zinc-700/50 px-3 py-1 text-[10px] font-medium text-zinc-300">
									<span class="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-zinc-400 border-t-transparent"></span>
									<span class="text-zinc-300">{verifyProgress.done}/{verifyProgress.total}</span>
									<button
										onclick={cancelVerify}
										class="ml-1 rounded px-1 text-[9px] text-zinc-500 transition-colors hover:text-zinc-300"
									>
										stop
									</button>
								</div>
							{:else}
								<button
									onclick={handleVerifyTop}
									class="rounded-lg bg-zinc-700/50 px-3 py-1 text-[10px] font-medium text-zinc-300 transition-all hover:bg-zinc-600/50 hover:text-white"
								>
									test top 10
								</button>
								<button
									onclick={handleVerifyAll}
									class="rounded-lg bg-zinc-700/50 px-3 py-1 text-[10px] font-medium text-zinc-300 transition-all hover:bg-zinc-600/50 hover:text-white"
								>
									test all
								</button>
							{/if}
								<button
									onclick={copyAllEmails}
									class="rounded-lg bg-zinc-800/50 px-3 py-1 text-[10px] font-medium text-zinc-400 transition-all hover:bg-zinc-700/50 hover:text-zinc-200"
								>
									{copied ? 'copied!' : 'copy all'}
								</button>
								<button
									onclick={downloadCSV}
									class="rounded-lg bg-zinc-800/50 px-3 py-1 text-[10px] font-medium text-zinc-400 transition-all hover:bg-zinc-700/50 hover:text-zinc-200"
								>
									csv
								</button>
							{/if}
						</div>

						{#if providers.length > 1}
							<div class="flex flex-wrap gap-1">
								<button
									onclick={() => (providerFilter = 'all')}
									class="rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all
										{providerFilter === 'all'
										? 'bg-zinc-700/60 text-zinc-300'
										: 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
								>
									all
								</button>
								{#each providers as provider}
									<button
										onclick={() => (providerFilter = provider)}
										class="rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all
											{providerFilter === provider
											? 'bg-zinc-700/60 text-zinc-300'
											: 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
									>
										{provider.toLowerCase()}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="flex flex-col lg:flex-row">
						<div class="min-w-0 flex-1 {selectedEmail ? 'lg:border-r lg:border-zinc-800/50' : ''}">
							{#if displaySuggestions.length === 0}
								<div class="px-4 py-8 text-center">
									<p class="text-[11px] text-zinc-600">no matches</p>
								</div>
							{:else}
								<div class="max-h-[520px] overflow-y-auto">
									{#each displaySuggestions as result}
										{@const v = verificationResults[result.email]}
										{@const leaked = hasLeaks(result.email)}
										{@const confirmed = isConfirmed(result.email)}
										{@const atIdx = result.email.indexOf('@')}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											onclick={() => selectEmail(result.email)}
											onkeydown={(e) => { if (e.key === 'Enter') selectEmail(result.email); }}
											class="group flex cursor-pointer items-center gap-3 border-b border-zinc-800/20 px-4 py-[7px] transition-all
												{selectedEmail === result.email ? 'bg-zinc-800/40 border-l-2 border-l-blue-400/60 pl-3.5' : 'hover:bg-zinc-800/30'}
												{leaked ? 'border-l-2 border-l-amber-500/40 pl-3.5' : confirmed && selectedEmail !== result.email ? 'border-l-2 border-l-emerald-500/30 pl-3.5' : ''}"
											role="option"
											tabindex="0"
											aria-selected={selectedEmail === result.email}
										>
											{#if v?.layers.signals.gravatar}
											<img
												src={gravatarUrl(result.email)}
												alt=""
												class="h-5 w-5 shrink-0 rounded-full ring-1 ring-zinc-500/40"
											/>
										{/if}

										<span class="min-w-0 flex-1 truncate font-mono text-[13px]">
											<span class="{leaked ? 'text-zinc-200' : 'text-zinc-400'} group-hover:text-zinc-200">{result.email.substring(0, atIdx)}</span><span class="text-zinc-600">@</span><span class="text-zinc-500 group-hover:text-zinc-300">{result.email.substring(atIdx + 1)}</span>
										</span>

										<div class="flex shrink-0 items-center gap-1">
											{#if v}
												<span
													class="rounded-md border px-1.5 py-px text-[8px] font-bold {verdictStyle(v.verdict)}"
												>
													{verdictLabel(v.verdict)}
												</span>
											{/if}
											{#if v?.layers.signals.xposedOrNot.found}
												<span class="rounded-md bg-zinc-700/50 px-1.5 py-px text-[8px] font-bold text-amber-400">BREACH</span>
											{/if}
											{#if v?.layers.signals.leakCheck.found}
												<span class="rounded-md bg-zinc-700/50 px-1.5 py-px text-[8px] font-bold text-amber-400">LEAK</span>
											{/if}
											{#if v?.layers.signals.microsoft.found}
												<span class="rounded-md bg-zinc-700/50 px-1.5 py-px text-[8px] font-medium text-zinc-400">MS</span>
											{/if}
											{#if v?.layers.signals.microsoft.throttled}
												<span class="rounded-md bg-amber-500/15 px-1.5 py-px text-[8px] font-medium text-amber-400">throttled</span>
											{/if}
											{#if v?.layers.signals.spotify.found}
												<span class="rounded-md bg-zinc-700/50 px-1.5 py-px text-[8px] font-medium text-zinc-400">Spotify</span>
											{/if}
											{#if v?.layers.provider?.throttled}
												<span class="rounded-md bg-amber-500/15 px-1.5 py-px text-[8px] font-medium text-amber-400">throttled</span>
											{/if}
											{#if v?.layers.provider?.exists && v.verdict !== 'valid'}
												<span class="rounded-md bg-zinc-700/50 px-1.5 py-px text-[8px] font-medium text-zinc-300">confirmed</span>
											{/if}
										</div>

											{#if result.score > 0}
												<span class="w-6 shrink-0 text-right font-mono text-[10px] text-zinc-600">
													{(result.score * 100).toFixed(0)}
												</span>
											{/if}

											<div class="w-10 shrink-0 text-right">
												{#if verifyingSingle === result.email}
													<span class="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent"></span>
												{:else if !v}
													<button
														type="button"
														onclick={(e) => { e.stopPropagation(); handleVerifySingle(result.email); }}
														class="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[9px] text-zinc-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-zinc-700/50 hover:text-zinc-300"
													>
														test
													</button>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						{#if selectedEmail && selectedResult}
							{@const sv = selectedVerification}
							{@const sLeaked = hasLeaks(selectedEmail)}
							<div class="w-full border-t border-zinc-800/50 lg:w-80 lg:border-t-0 xl:w-96">
								<div class="p-4">
									<div class="mb-4">
									<code class="break-all text-sm font-bold"><span class="{sLeaked ? 'text-zinc-300' : 'text-white'}">{selectedEmail.split('@')[0]}</span><span class="text-zinc-600">@</span><span class="text-blue-400/70">{selectedEmail.split('@')[1]}</span></code>
										<div class="mt-1 flex items-center gap-2 text-[10px]">
											<span class="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-zinc-400">{selectedResult.pattern}</span>
											<span class="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-zinc-400">{selectedResult.category}</span>
										</div>
									</div>

									{#if sv}
										<div class="mb-4 flex items-center gap-3">
											<span class="rounded-xl border px-4 py-2 text-sm font-bold {verdictStyle(sv.verdict)}">
												{verdictLabel(sv.verdict)}
											</span>
											<div class="group relative text-xs cursor-default">
												<div class="font-medium text-zinc-300">{sv.confidence}%</div>
												<div class="text-[9px] text-zinc-600">confidence</div>
												<div class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2.5 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
													<div class="mb-1.5 whitespace-nowrap text-[10px] font-bold tracking-widest text-zinc-400 uppercase">breakdown</div>
													{#if sv.layers.provider && !sv.layers.provider.throttled}
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="text-zinc-400">Provider {sv.layers.provider.exists ? 'confirmed' : 'denied'}</span>
															<span class="font-mono text-zinc-300">{sv.layers.provider.exists ? '99' : '95'}%</span>
														</div>
													{:else}
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="text-zinc-500">Base</span>
															<span class="font-mono text-zinc-400">50</span>
														</div>
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="{sv.layers.signals.gravatar ? 'text-zinc-300' : 'text-zinc-600'}">Gravatar</span>
															<span class="font-mono {sv.layers.signals.gravatar ? 'text-emerald-400' : 'text-zinc-700'}">{sv.layers.signals.gravatar ? '+25' : '—'}</span>
														</div>
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="{sv.layers.signals.microsoft.found ? 'text-zinc-300' : 'text-zinc-600'}">Microsoft</span>
															<span class="font-mono {sv.layers.signals.microsoft.found ? 'text-emerald-400' : 'text-zinc-700'}">{sv.layers.signals.microsoft.found ? '+15' : '—'}</span>
														</div>
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="{sv.layers.signals.spotify.found ? 'text-zinc-300' : 'text-zinc-600'}">Spotify</span>
															<span class="font-mono {sv.layers.signals.spotify.found ? 'text-emerald-400' : 'text-zinc-700'}">{sv.layers.signals.spotify.found ? '+10' : '—'}</span>
														</div>
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="{sv.layers.signals.xposedOrNot.found ? 'text-zinc-300' : 'text-zinc-600'}">Breach data</span>
															<span class="font-mono {sv.layers.signals.xposedOrNot.found ? 'text-emerald-400' : 'text-zinc-700'}">{sv.layers.signals.xposedOrNot.found ? '+20' : '—'}</span>
														</div>
														<div class="flex items-center justify-between gap-4 whitespace-nowrap text-[11px]">
															<span class="{sv.layers.signals.leakCheck.found ? 'text-zinc-300' : 'text-zinc-600'}">Leak data</span>
															<span class="font-mono {sv.layers.signals.leakCheck.found ? 'text-emerald-400' : 'text-zinc-700'}">{sv.layers.signals.leakCheck.found ? '+15' : '—'}</span>
														</div>
														<div class="mt-1.5 flex items-center justify-between gap-4 border-t border-zinc-700/40 pt-1.5 whitespace-nowrap text-[11px]">
															<span class="font-medium text-zinc-300">Total</span>
															<span class="font-mono font-medium text-zinc-200">{sv.confidence}%</span>
														</div>
													{/if}
													<div class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-700/60"></div>
												</div>
											</div>
										</div>

										<div class="mb-4 space-y-1">
											<h3 class="mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">checks</h3>
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.syntax.valid ? 'bg-emerald-500/50' : 'bg-zinc-600'}"></span>
												<span class="text-zinc-300">Syntax</span>
												<span class="{sv.layers.syntax.valid ? 'text-zinc-300' : 'text-zinc-500'} ml-auto text-[11px] font-medium">{sv.layers.syntax.valid ? 'valid' : sv.layers.syntax.error || 'invalid'}</span>
											</div>
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.mx.valid ? 'bg-emerald-500/50' : 'bg-zinc-600'}"></span>
												<span class="text-zinc-300">MX Record</span>
												<span class="{sv.layers.mx.valid ? 'text-zinc-300' : 'text-zinc-500'} ml-auto text-[11px] font-medium">{sv.layers.mx.valid ? 'found' : 'missing'}</span>
											</div>
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.disposable.isDisposable ? 'bg-zinc-600' : 'bg-emerald-500/50'}"></span>
												<span class="text-zinc-300">Disposable</span>
												<span class="text-zinc-500 ml-auto text-[11px] font-medium">{sv.layers.disposable.isDisposable ? 'yes' : 'no'}</span>
											</div>
											{#if sv.layers.provider}
												<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
													<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.provider.exists ? 'bg-emerald-500/50' : sv.layers.provider.throttled ? 'bg-amber-400/60' : 'bg-zinc-600'}"></span>
													<span class="text-zinc-300">Provider</span>
													<span class="{sv.layers.provider.exists ? 'text-zinc-300' : sv.layers.provider.throttled ? 'text-amber-400/70' : 'text-zinc-500'} ml-auto text-[11px] font-medium">
														{sv.layers.provider.exists ? 'exists' : sv.layers.provider.throttled ? 'throttled' : 'not found'}
													</span>
												</div>
											{/if}
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												{#if sv.layers.signals.gravatar}
													<img src={gravatarUrl(selectedEmail ?? '')} alt="" class="h-5 w-5 shrink-0 rounded-full ring-1 ring-zinc-500/40" />
												{:else}
													<span class="inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-700"></span>
												{/if}
												<span class="text-zinc-300">Gravatar</span>
												<span class="{sv.layers.signals.gravatar ? 'text-zinc-300' : 'text-zinc-600'} ml-auto text-[11px] font-medium">{sv.layers.signals.gravatar ? 'found' : 'none'}</span>
											</div>
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.signals.microsoft.found ? 'bg-emerald-500/50' : sv.layers.signals.microsoft.throttled ? 'bg-amber-400/60' : 'bg-zinc-700'}"></span>
												<span class="text-zinc-300">Microsoft</span>
												<span class="{sv.layers.signals.microsoft.found ? 'text-zinc-300' : sv.layers.signals.microsoft.throttled ? 'text-amber-400/70' : 'text-zinc-600'} ml-auto text-[11px] font-medium">{sv.layers.signals.microsoft.found ? 'found' : sv.layers.signals.microsoft.throttled ? 'throttled' : 'none'}</span>
											</div>
											<div class="flex items-center gap-2.5 rounded-lg bg-zinc-800/30 px-3 py-1.5 text-xs">
												<span class="inline-block h-2 w-2 shrink-0 rounded-full {sv.layers.signals.spotify.found ? 'bg-emerald-500/50' : 'bg-zinc-700'}"></span>
												<span class="text-zinc-300">Spotify</span>
												<span class="{sv.layers.signals.spotify.found ? 'text-zinc-300' : 'text-zinc-600'} ml-auto text-[11px] font-medium">{sv.layers.signals.spotify.found ? 'found' : 'none'}</span>
											</div>
										</div>

										{#if sv.layers.signals.xposedOrNot.found || sv.layers.signals.leakCheck.found}
											<div class="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-3">
												<h3 class="mb-2 text-xs font-bold text-zinc-300">Data Exposure</h3>
												{#if sv.layers.signals.xposedOrNot.found}
													<div class="mb-2">
														<div class="flex items-center gap-1.5">
															<span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
															<span class="text-xs font-bold text-zinc-300">Breach Detected</span>
														</div>
														{#if sv.layers.signals.xposedOrNot.breaches?.length}
															<div class="mt-1.5 flex flex-wrap gap-1 pl-3.5">
																{#each sv.layers.signals.xposedOrNot.breaches.slice(0, 8) as breach}
																	<span class="rounded-md bg-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">{breach}</span>
																{/each}
																{#if sv.layers.signals.xposedOrNot.breaches.length > 8}
																	<span class="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">+{sv.layers.signals.xposedOrNot.breaches.length - 8} more</span>
																{/if}
															</div>
														{/if}
													</div>
												{/if}
												{#if sv.layers.signals.leakCheck.found}
													<div>
														<div class="flex items-center gap-1.5">
															<span class="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
															<span class="text-xs font-bold text-zinc-300">Leak Detected</span>
														</div>
														{#if sv.layers.signals.leakCheck.sources?.length}
															<div class="mt-1.5 flex flex-wrap gap-1 pl-3.5">
																{#each sv.layers.signals.leakCheck.sources as source}
																	<span class="rounded-md bg-zinc-700/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">{source}</span>
																{/each}
															</div>
														{/if}
													</div>
												{/if}
											</div>
										{/if}

										{#if sv.layers.provider?.meta?.accountCreated}
											<div class="mt-3 text-[11px] text-zinc-500">
												<span class="text-zinc-600">Account created:</span> {sv.layers.provider.meta.accountCreated}
											</div>
										{/if}
									{:else if verifyingSingle === selectedEmail}
										<div class="space-y-3">
											<div class="mb-3 flex items-center gap-2">
												<span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></span>
												<span class="text-xs text-zinc-300">Running checks...</span>
											</div>
											<div class="space-y-2">
												{#each ['Syntax validation', 'MX record lookup', 'Disposable check', 'Provider check', 'Gravatar lookup', 'Microsoft account', 'Spotify account', 'Breach databases'] as step, i}
													<div class="flex items-center gap-2 text-[11px]">
														<span class="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-zinc-400/50" style="animation-delay: {i * 150}ms"></span>
														<span class="text-zinc-500">{step}</span>
													</div>
												{/each}
											</div>
										</div>
									{:else}
										<button
											onclick={() => handleVerifySingle(selectedEmail ?? '')}
											class="w-full rounded-xl bg-zinc-700/50 px-3 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-600/50 hover:text-white"
										>
											test this email
										</button>
									{/if}

									<div class="mt-4 border-t border-zinc-800/50 pt-4">
										<h3 class="mb-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">score</h3>
										<div class="space-y-2">
											<div class="flex items-center justify-between text-[11px]">
												<span class="text-zinc-400">Commonality</span>
												<div class="flex items-center gap-2">
													<div class="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
														<div class="h-full rounded-full bg-zinc-400 transition-all" style="width: {selectedResult.commonality * 100}%"></div>
													</div>
													<span class="w-7 text-right font-medium text-zinc-300">{(selectedResult.commonality * 100).toFixed(0)}</span>
												</div>
											</div>
											<div class="flex items-center justify-between text-[11px]">
												<span class="text-zinc-400">Identifiability</span>
												<div class="flex items-center gap-2">
													<div class="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
														<div class="h-full rounded-full bg-zinc-400 transition-all" style="width: {selectedResult.identifiability * 100}%"></div>
													</div>
													<span class="w-7 text-right font-medium text-zinc-300">{(selectedResult.identifiability * 100).toFixed(0)}</span>
												</div>
											</div>
											<div class="mt-1 flex items-center justify-between border-t border-zinc-800/30 pt-2 text-[11px]">
												<span class="text-zinc-400">Overall</span>
												<span class="text-base font-bold text-white">{(selectedResult.score * 100).toFixed(0)}</span>
											</div>
										</div>
									</div>

									<button
										onclick={() => { query = selectedEmail ?? ''; }}
										class="mt-4 w-full rounded-xl border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-[11px] text-zinc-400 transition-all hover:border-zinc-600 hover:bg-zinc-700/30 hover:text-zinc-300"
									>
										use in query
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
		</div>
		{/if}

		<div class="elevation-1 card-transition mb-5 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60">
			<button
				onclick={() => (showReference = !showReference)}
				class="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-zinc-800/30"
			>
				<div class="flex items-center gap-2">
					<div class="h-3 w-0.5 rounded-full bg-cyan-500/50"></div>
					<span class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">provider reference</span>
				</div>
				<span class="rounded-md bg-zinc-800/50 px-2 py-0.5 text-[10px] text-zinc-600">{showReference ? '-' : '+'}</span>
			</button>

			{#if showReference}
				<div class="border-t border-zinc-800/50 px-5 pb-4 pt-3">
					<div class="overflow-x-auto">
						<table class="w-full text-[11px]">
							<thead>
								<tr class="border-b border-zinc-800/50">
									<th class="py-2 pr-3 text-left text-[10px] font-bold text-zinc-500">provider</th>
									<th class="px-3 py-2 text-left text-[10px] font-bold text-zinc-500">domains</th>
									<th class="px-3 py-2 text-left text-[10px] font-bold text-zinc-500">rules</th>
								</tr>
							</thead>
							<tbody>
								{#each PROVIDER_INFO as p}
									<tr class="border-b border-zinc-800/20 transition-colors hover:bg-zinc-800/20">
										<td class="py-2 pr-3 font-medium text-zinc-200">{p.name}</td>
										<td class="px-3 py-2 font-mono text-[10px] text-blue-400/50">{p.domains.join(', ')}</td>
										<td class="px-3 py-2 text-zinc-500">{p.rules}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>

		<div class="elevation-1 card-transition mb-5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-5 py-4">
			<div class="mb-3 flex items-center gap-2">
				<div class="h-3 w-0.5 rounded-full bg-rose-500/50"></div>
				<span class="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">osint tools</span>
			</div>
			<div class="grid grid-cols-3 gap-1.5">
				<a href="https://epieos.com" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 rounded-lg bg-zinc-800/30 px-3 py-2 text-[11px] text-zinc-400 transition-all hover:bg-zinc-700/30 hover:text-zinc-300">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500/60"></span>
					epieos
				</a>
				<a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 rounded-lg bg-zinc-800/30 px-3 py-2 text-[11px] text-zinc-400 transition-all hover:bg-zinc-700/30 hover:text-zinc-300">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500/60"></span>
					haveibeenpwned
				</a>
				<a href="https://osint.industries" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 rounded-lg bg-zinc-800/30 px-3 py-2 text-[11px] text-zinc-400 transition-all hover:bg-zinc-700/30 hover:text-zinc-300">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500/60"></span>
					osint.industries
				</a>
			</div>
		</div>

		<p class="mb-6 text-center text-[10px] leading-relaxed text-zinc-700">
			generates possible emails from personal information based on common patterns and performs basic verification checks
		</p>
	</div>
</div>
