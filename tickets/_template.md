# TICKET-XXX: [Korte titel]

**Status:** Draft / Ready for Build / In Build / In Review / Done
**Grootte:** XS / S / M / L
**Aangemaakt door:** Architect
**Datum:** YYYY-MM-DD

## Doel
[Één zin. Wat lost dit op voor de gebruiker?]

## Scope

### Wel
- [Concreet wat er gebouwd wordt]
- [Nog een ding]

### Niet
- [Wat bewust níet in dit ticket zit]
- [Wat een vervolgticket zou moeten zijn]

## Acceptatiecriteria
Concrete, testbare uitspraken. De Builder loopt ze langs, de Reviewer
controleert ze.

1. [ ] Gebruiker kan X doen
2. [ ] Wanneer Y gebeurt, laat de app Z zien
3. [ ] Bij foutieve input toont de app melding "..."
4. [ ] Tests dekken alle bovenstaande gedragingen

## Bestanden die geraakt worden
- `server.js` (regel X aangepast) — geef regelbereik aan
- `routes/voorbeeld.routes.js` (nieuw)
- `tests/voorbeeld.test.js` (nieuw)

## Tests
- Welke bestaande tests moeten nog groen blijven?
- Welke tests moeten nieuw bijkomen?
- Wat zijn de edge cases?

## Mockup
[Link naar artifact of inline SVG/HTML voor UI-wijzigingen. Voor pure
backend-tickets: N/A]

## Technische notities
[Alleen als er iets niet-triviaals speelt. Anders weglaten. De Builder leest
CLAUDE.md voor de rest.]

## Architect self-check
- [ ] Is dit klein genoeg? (Max 50 regels wijziging, max 3-4 wijzigingen)
- [ ] Is dit één probleem, niet twee?
- [ ] Zijn acceptatiecriteria testbaar zonder menselijke oordelen?
- [ ] Raakt dit server.js? Zo ja: welk deel precies (regelbereik)?
