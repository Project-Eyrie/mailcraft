// Multi-layer email verification API that checks syntax, MX records, disposable status, and breach databases
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveMx } from 'dns/promises';

interface VerificationResult {
	email: string;
	layers: {
		syntax: { valid: boolean; error?: string };
		mx: { valid: boolean; records?: string[] };
		disposable: { isDisposable: boolean };
		breaches: {
			xposedOrNot: { found: boolean; breaches?: string[] };
			leakCheck: { found: boolean; sources?: string[] };
		};
	};
	verdict: 'invalid' | 'unknown';
	breachCount: number;
}

// Validates email syntax against RFC 5321 and provider-specific rules
function checkSyntax(email: string): { valid: boolean; error?: string } {
	const trimmed = email.trim().toLowerCase();
	if (trimmed.length > 254) return { valid: false, error: 'Too long' };

	const parts = trimmed.split('@');
	if (parts.length !== 2) return { valid: false, error: 'Invalid format' };

	const [local, domain] = parts;
	if (local.length < 1 || local.length > 64) return { valid: false, error: 'Local part length' };
	if (/\.\./.test(local)) return { valid: false, error: 'Consecutive dots' };
	if (/^\.|\.$/.test(local)) return { valid: false, error: 'Leading/trailing dot' };
	if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return { valid: false, error: 'Invalid characters' };

	if (['gmail.com', 'googlemail.com'].includes(domain)) {
		const base = local.split('+')[0].replace(/\./g, '');
		if (base.length < 6 || base.length > 30) return { valid: false, error: 'Gmail: 6-30 chars' };
		if (!/^[a-z0-9.]+$/.test(local.split('+')[0])) return { valid: false, error: 'Gmail: letters, numbers, dots only' };
	}

	if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
		if (!/^[a-z]/.test(local)) return { valid: false, error: 'Outlook: must start with letter' };
		if (!/^[a-z0-9._-]+$/.test(local)) return { valid: false, error: 'Outlook: invalid characters' };
	}

	if (['yahoo.com', 'ymail.com', 'rocketmail.com'].includes(domain)) {
		if (local.length < 4 || local.length > 32) return { valid: false, error: 'Yahoo: 4-32 chars' };
		if (!/^[a-z]/.test(local)) return { valid: false, error: 'Yahoo: must start with letter' };
	}

	if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
		const base = local.split('+')[0];
		if (base.length < 3 || base.length > 20) return { valid: false, error: 'iCloud: 3-20 chars' };
		if (!/^[a-z]/.test(local)) return { valid: false, error: 'iCloud: must start with letter' };
	}

	return { valid: true };
}

// Checks if the email domain has valid MX records via DNS lookup
async function checkMX(email: string): Promise<{ valid: boolean; records?: string[] }> {
	const domain = email.split('@')[1];
	try {
		const mx = await resolveMx(domain);
		if (mx.length === 0) return { valid: false };
		return {
			valid: true,
			records: mx.sort((a, b) => a.priority - b.priority).map((r) => r.exchange)
		};
	} catch {
		return { valid: false };
	}
}

// Checks if the email domain is a known disposable/temporary email provider
async function checkDisposable(email: string): Promise<{ isDisposable: boolean }> {
	try {
		const MailChecker = await import('mailchecker');
		const isValid = MailChecker.default?.isValid ?? MailChecker.isValid;
		return { isDisposable: !isValid(email) };
	} catch {
		return { isDisposable: false };
	}
}

// Queries the XposedOrNot breach database to find if the email appears in known data breaches
async function checkXposedOrNot(email: string): Promise<{
	found: boolean;
	breaches?: string[];
}> {
	try {
		const res = await fetch(
			`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
			{
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(8000)
			}
		);
		if (!res.ok) return { found: false };
		const data = await res.json();
		const breaches: string[] = [];
		if (data.ExposedBreaches?.breaches_details) {
			for (const b of data.ExposedBreaches.breaches_details) {
				if (b.breach) breaches.push(b.breach);
			}
		}
		return { found: breaches.length > 0, breaches };
	} catch {
		return { found: false };
	}
}

// Queries the LeakCheck public API to find if the email appears in known data leaks
async function checkLeakCheck(email: string): Promise<{
	found: boolean;
	sources?: string[];
}> {
	try {
		const res = await fetch(
			`https://leakcheck.io/api/public?check=${encodeURIComponent(email)}`,
			{ signal: AbortSignal.timeout(8000) }
		);
		if (!res.ok) return { found: false };
		const data = await res.json();
		if (data.success && data.found > 0) {
			return {
				found: true,
				sources: data.sources?.map((s: { name: string }) => s.name) ?? []
			};
		}
		return { found: false };
	} catch {
		return { found: false };
	}
}

// Orchestrates all verification layers and computes a verdict with breach count for an email
async function verifyEmail(email: string): Promise<VerificationResult> {
	const normalized = email.trim().toLowerCase();
	const emptyBreaches = { xposedOrNot: { found: false }, leakCheck: { found: false } };

	const syntax = checkSyntax(normalized);
	if (!syntax.valid) {
		return {
			email: normalized,
			layers: { syntax, mx: { valid: false }, disposable: { isDisposable: false }, breaches: emptyBreaches },
			verdict: 'invalid',
			breachCount: 0
		};
	}

	const [mx, disposable] = await Promise.all([
		checkMX(normalized),
		checkDisposable(normalized)
	]);

	if (!mx.valid) {
		return {
			email: normalized,
			layers: { syntax, mx, disposable, breaches: emptyBreaches },
			verdict: 'invalid',
			breachCount: 0
		};
	}

	if (disposable.isDisposable) {
		return {
			email: normalized,
			layers: { syntax, mx, disposable, breaches: emptyBreaches },
			verdict: 'invalid',
			breachCount: 0
		};
	}

	const [xon, lc] = await Promise.all([
		checkXposedOrNot(normalized),
		checkLeakCheck(normalized)
	]);

	const breachCount = (xon.breaches?.length ?? 0) + (lc.sources?.length ?? 0);

	return {
		email: normalized,
		layers: {
			syntax,
			mx,
			disposable,
			breaches: {
				xposedOrNot: xon,
				leakCheck: lc
			}
		},
		verdict: 'unknown',
		breachCount
	};
}

// Handles POST requests to verify up to 10 emails sequentially with rate-limiting delays
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const emails: string[] = body.emails;

	if (!Array.isArray(emails) || emails.length === 0) {
		return json({ error: 'No emails provided' }, { status: 400 });
	}

	const toCheck = emails.slice(0, 10);

	const results: VerificationResult[] = [];
	for (let i = 0; i < toCheck.length; i++) {
		const result = await verifyEmail(toCheck[i]);
		results.push(result);
		if (i < toCheck.length - 1) {
			await new Promise((r) => setTimeout(r, 500));
		}
	}

	return json({ results });
};
