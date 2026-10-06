# 01 — Architecture

> **Version** 0.1 · **Date** 2026-10-06 · **Status** DRAFT ◐. Generated from the owner's direction of 2026-10-06 and CapWatch law (intracalc `brand/guidelines/03` §11a, `06` P13, `sales/seed/paper.md` §2).

## 1. The house and its products

Reality Reach Technologies LLP is the legal person **and** the house brand, *Reality Reach*. Products carry their own identities, and the house endorses them. The house never absorbs a product. CapWatch's own analogy applies: CapWatch is invoiced by the LLP "the way a Claude subscription is invoiced by Anthropic" (CapWatch `06` §P10). ✅ *(owner, 2026-10-06: "RR is the parent, capwatch is specific product brand")*

| Name | Role | Identity |
|---|---|---|
| Reality Reach | the house: who is dealt with, who signs, who invoices | the diamond-R mark, this department |
| CapWatch | product brand, in market | its own: the reversed watch, intracalc `brand/` |
| Antaxial | private deployment, not productised | no public identity ◐ |
| Undisclosed work | in development | none, by rule (§4) |

## 2. On product surfaces: the house as attribution

This is CapWatch law, inherited verbatim and unchanged here.
- On CapWatch surfaces the LLP is text: the entity block, the footer line "Made by Reality Reach Technologies LLP." (`intracalc-web/components/site-footer.tsx`), and the statutory lines.
- The corporate lockup appears only in the apps, at the foot of Splash, Login, OTP and Settings, through `CorporateBranding`: "from", then the lockup at 36 pt, centred (CapWatch `06` P13).
- Never in a header, never beside the caseback at parity. No corporate mark shares a sheet or a screen with the CapWatch mark (CapWatch `03` §11a).

## 3. On house surfaces: how a product appears

The mirror of §2 ◐:
1. **A product appears in its own identity**: its master mark unaltered, its canonical copy verbatim, on its own ground. On realityreach.com the CapWatch feature is a full-viewport dark section in capwatch.in's language. The headline is "Automated Capital Governance" and the identity line is verbatim.
2. **The house mark never shares that view at parity.** There is no RR mark inside a product feature. The site header hides on scroll so the feature stands alone.
3. **The house never paraphrases a product.** It quotes the product's live copy (capwatch.in is canonical; CapWatch `01` §10, 2026-10-02). Retired CapWatch lines stay retired here too.
4. **Store badges are official artwork, unaltered**, at one shared height (`intracalc-web/components/site/store-badges.tsx`).
5. **A product mark is never redrawn, never rendered in ASCII, never placed inside a figure** (`09` §2.4).

## 4. The disclosure ladder

What the house shows of its work. A move between tiers is an owner decision, logged in `DECISIONS.md`.

| Tier | Is | On house surfaces | Today |
|---|---|---|---|
| 1 · In market | public, sold, installable | **featured**: name, mark, category line, store links | CapWatch |
| 2 · Private deployment | delivered to named clients, not productised | **named once, one line**: no mark, no client, no figures, no screenshots, no link that implies availability | Antaxial: "Construction operations · Private deployment" ◐ |
| 3 · Undisclosed | in development | **never named, never described**, not even by category ("hardware", "IoT", "devices"). At most one unnamed line: "Not yet public." | ✅ *(owner, 2026-10-06: "hardware… name shouldnt be mentioned… maybe not even the full concept")* |
| 4 · Client work | done for clients | never named without the client's written consent (decadal L05) | — |

**Retired names, never on house surfaces** ◐:
- *Intracalc*: CapWatch's former name. The Play package id `com.realityreach.intracalc` survives only inside the store URL.
- *Innovating Across Dimensions*: the placeholder's tagline.
- "IoT (Stealth)".
- The old repo's three invented product lines ("Mobile Integrations", "Modular Cloud Storage").
- Legacy apps (we-shape and others).

## 5. Names

- **First mention, and every legal context:** Reality Reach Technologies LLP.
- **After that, in prose:** Reality Reach.
- **Domain:** realityreach.com, lowercase.
- **The wordmark** is the master's two lines, REALITY REACH / TECHNOLOGIES, used only as artwork, never typed.
- **Never in public:** "RR" (internal shorthand only), "RealityReach", "Realityreach", "Reality Reach Tech", or "Reality Reach Technologies" without "LLP" in a legal line ◐.

## 6. The entity block

LLP Act 2008 s.21 requires these lines on the website, invoices and official correspondence. Values come from intracalc `sales/seed/paper.md` §2 and `intracalc-web/lib/site-facts.ts` `ENTITY`.

| Line | Value | Where it is required |
|---|---|---|
| Name | Reality Reach Technologies LLP | s.21 |
| Statement | registered with limited liability | s.21, verbatim. Absent from the live placeholder; the new site carries it. |
| LLPIN | ABB-8295 | s.21 |
| Registered office | W. No-21, H.No.1687, Ichalkaranji, Maharashtra 416115, India | s.21 |
| GSTIN | 27ABFFR4467E1Z1 | invoices. The PAN sits inside it and is never written out separately. |
| DPIIT recognition | DIPP109510 | public fact; a credential, not a statutory line |
| Founded | 2022 | live site |

**Never in any file** (paper.md rule 2): PAN, TAN, bank details, the Udyam number (until verified, and then only on invoices), signatory details.

**Credentials are facts, never badges of intent** (decadal L03): "ISO 27001 · Planned", "GDPR · Planned" and "D-U-N-S® · Coming soon" from the old repo are never shown. A credential appears when it exists.

## 7. Addresses and lines

| Contact | Seen today | Status |
|---|---|---|
| support@realityreach.com | capwatch.in policies; every CapWatch sheet and email | ✅ canonical "everywhere: the site, the apps, every sheet, every email" *(owner, 2026-09-17, `sales/seed/paper.md` §2)* |
| admin@realityreach.com | live realityreach.com placeholder | legacy |
| info@realityreach.com | the owner's earlier repo (contact, careers) | legacy; unverified that it receives mail |
| +91 91450 27365 | live placeholder | ⬜ |
| WhatsApp 91 79095 95999 | capwatch.in demo line (`site-facts.ts`) | CapWatch's line; not a house line |

**Inconsistency, flagged.** The build contract puts admin@ on the new site's Contact section. That conflicts with the support@ ruling. Recommendation: support@ until the owner names a house address (`OPEN-QUESTIONS` Q1).

## 8. Mail hygiene

Checked live with `dig` on 2026-10-06:
- realityreach.com still publishes **two SPF records**: `v=spf1 include:dc-aa8e722993._spfm.realityreach.com ~all` and `v=spf1 include:_spf.firebasemail.com ~all`. SPF therefore fails.
- It has **no `_dmarc` record**.
- MX is Google.

This is unchanged since the 2026-09-24 finding (intracalc `brand/legal/threats.md` T04, `pipeline.md` N6, `roadmap.md` R07). A house site that invites a conversation by email makes spoofed mail in the LLP's name more likely to succeed. The fix is the owner's DNS action, about ten minutes, with the records already drafted in N6:
1. Merge the two records into one SPF.
2. Add DMARC at `p=none` with reports.
3. Move to quarantine and then reject after clean reports.

Do this before the new site goes live ◐.
