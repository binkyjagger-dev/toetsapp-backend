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
