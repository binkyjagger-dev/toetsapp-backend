# Werkafspraken voor Claude Code

## Bij elke nieuwe feature
1. Schrijf eerst de test (red/green TDD)
2. Bevestig dat de test faalt
3. Schrijf dan pas de code
4. Bevestig dat de test slaagt

## Bij elke bugfix
1. Schrijf een test die de bug reproduceert
2. Bevestig dat de test faalt (bug bestaat)
3. Fix de bug
4. Bevestig dat de test slaagt (bug opgelost)

## Na elke sessie
- Draai npm test — alle tests groen?
- npm test draait automatisch lint:html mee
- Een syntaxfout in index.html laat npm test nu falen voor je deployt
- git add . && git commit -m "beschrijving"

## Nooit
- str_replace op een getrunceerde string
- <script src=""> met inline code erin
- const twee keer declareren in dezelfde scope
- Een functie aanpassen zonder de huidige
  versie eerst volledig te lezen

## Coding principes (Simon Willison)

### Voor je code schrijft
- Lees eerst de exacte functie of sectie die je aanpast
- Citeer de eerste en laatste regel van wat je gaat wijzigen
- Schrijf in één zin wat je gaat veranderen
- Vraag bevestiging als je meer dan één functie aanpast

### Terwijl je code schrijft
- Wijzig nooit meer dan één ding tegelijk
- Gebruik altijd str_replace — nooit een heel bestand herschrijven
- Voer na elke wijziging node --check uit
- Schrijf nooit const x = ... twee keer in dezelfde scope
- Geen bulk-operaties: splits grote wijzigingen op in stappen

### Na elke wijziging
- Voer npm test uit
- Alle bestaande tests moeten groen blijven
- Commit na elke werkende stap
- Schrijf altijd: "Deploy en test dan het volgende:"
  gevolgd door een concrete testlijst

### TDD werkwijze
- Beschrijf eerst wat de code moet doen (input → output)
- Schrijf tests (rood)
- Implementeer (groen)
- Pas nooit tests aan om ze te laten slagen

### Bij fouten
- Vraag altijd om de exacte foutmelding
- Analyseer volledig voor je een oplossing schrijft
- Schrijf één oplossing — niet meerdere opties tegelijk
