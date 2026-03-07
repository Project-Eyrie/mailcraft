<div align="center">

# MailCraft

> Generate, discover, and verify possible email addresses from personal information using common naming patterns.

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![In Project Eyrie](https://img.shields.io/badge/IN-PROJECT%20EYRIE-b45309?style=for-the-badge&labelColor=0f172a)](https://github.com/Project-Eyrie)
![WEB](https://img.shields.io/badge/TYPE-WEB-0369a1?style=for-the-badge&labelColor=0f172a)

</div>

---

## Overview

**MailCraft** is an OSINT web tool built for investigators and researchers. It generates possible email addresses by combining personal information against common naming patterns across 24 email providers, then verifies them through multiple validation layers including provider APIs and breach databases.

---

## Features

- **Pattern Generation** - Combines names, birth dates, nicknames, and postcodes into 100+ email patterns across 24 providers with relevance scoring
- **Wildcard Search** - Filter results using `*` (any characters) and `_` (single character) pattern matching
- **Multi-Layer Verification** - Checks syntax, MX records, disposable status, provider existence (Microsoft API), and cross-provider signals (Gravatar, Spotify, breach databases)
- **Export and Share** - Copy results to clipboard, download as CSV, or share via URL with encoded application state

---

## How to Use

### About the App

Enter a first name, last name, and optional details (middle name, nickname, birth year, postcode) to generate possible email addresses. Results are scored by pattern commonality, identifiability, and provider market share. Select any email to view detailed scoring or run verification checks against it.

### Interface

| Area | Description |
|------|-------------|
| **Search & Filter** | Wildcard query input with quick-access domain buttons and custom domain support |
| **Person Details** | Input fields for name, birth year, and optional middle name, nickname, postcode, and birthday |
| **Patterns** | Toggle pattern categories on/off to control which email formats are generated |
| **Results List** | Scrollable list of generated emails with inline verification badges and scores |
| **Detail Sidebar** | Expanded view of a selected email showing scoring breakdown, verification layers, and data exposure |
| **Provider Reference** | Collapsible table of provider-specific email rules and domains |

---

## Theory and Background

### Scoring

Each generated email receives a relevance score based on:

- **Commonality** (35%) - How frequently the pattern appears in real-world usage
- **Identifiability** (45%) - How uniquely the pattern identifies the person
- **Provider Market Share** (20%) - Relative popularity of the email provider
- **PII Bonus** - Extra weight for patterns using additional personal information like birth year or nickname

### Verification Layers

Each address goes through five layers of checks:

1. **Syntax** - Validates the address format against RFC 5321 and provider-specific rules
2. **MX Records** - DNS lookup to confirm the domain accepts email
3. **Disposable Check** - Flags temporary/throwaway providers
4. **Provider Check** - Queries provider APIs directly where possible (e.g. Microsoft GetCredentialType) to determine if the account exists
5. **Cross-Provider Signals** - Checks for associated accounts on Gravatar, Microsoft, and Spotify, and searches breach databases via XposedOrNot and LeakCheck

After verification, each address gets a verdict: **valid**, **invalid**, **likely valid**, or **unknown**, along with a confidence percentage.

---

## Notes

- **Runtime** - Requires Node.js for the verification API server (MX lookups and provider checks run server-side)
- **Rate Limiting** - Verification requests are spaced 500ms apart to avoid provider throttling
- **Batch Limit** - Up to 10 emails can be verified at once via the API, or all results can be verified sequentially with abort support
- **State Persistence** - All application state is encoded in URL query parameters for sharing; data is not stored server-side

---

<div align="center">
  Part of Project Eyrie - by <a href="https://notalex.sh">notalex.sh</a>
</div>
