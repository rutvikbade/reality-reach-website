# Open questions

Each question has a recommended answer. A ruling moves into `DECISIONS.md` and the question is deleted here.

| # | Question | Recommendation | Why |
|---|---|---|---|
| Q1 | The steel lockup reads faint on white. In the header it is 30–32 px tall, the wordmark's cap height is about 7 px, and its stops measure 4.1, 3.4, 1.7 and 1.5:1 against white. Keep it as it is, enlarge it, or add a light-ground steel variant? | **Enlarge to ≥ 40 px in the header** and keep the steel master unaltered. If it still fades, add a light-ground steel variant with darker stops as a second master. | The owner ruled the steel gradient everywhere, so a flat black recolour is out. Size alone recovers most of the legibility. |
| Q2 | Should SPF and DMARC be fixed before launch? | **Yes.** Merge the two SPF records and add DMARC at `p=none` (records drafted in intracalc `brand/legal/pipeline.md` N6). | About ten minutes of DNS work. The site invites email, and spoofed mail in the LLP's name is a money risk. |
| Q3 | What goes on the OG / link-preview card? | **Interim (shipped):** a typographic card on the white micro-grid, with the steel lockup and the hero line and no ASCII. **Final:** add a FIG. 01 rest frame once the owner signs off the figures. | The preview is the first impression for most readers. The ASCII mark card it replaced broke two rulings. |

## Proposed seed items

For the owner to write in their own words in `seed/`, when ready:
- **S1** positioning and thesis;
- **S2** the disclosure ladder;
- **S3** the ASCII world: figures and meanings;
- **S4** the light ground and no accent;
- **S5** the house address.
