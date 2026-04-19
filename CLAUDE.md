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

## Checklist voor Claude Code bij elke wijziging

- Heb ik de functie die ik ga aanpassen gelezen
  en geciteerd (eerste + laatste regel)?
- Pas ik maar één ding tegelijk aan?
- Gebruik ik str_replace, niet een hele bestand
  herschrijven?
- Heb ik na deze wijziging node --check uitgevoerd?
- Zijn alle bestaande tests nog groen?
- Is dit één commit waard?

## HTML en JavaScript structuur — altijd volgen

### HTML hoort in HTML, JS hoort in JS
- Schrijf NOOIT grote HTML-strings in JavaScript functies
- Gebruik <template> elementen in mol-lesvorm.html of
  index.html voor herbruikbare HTML-structuren
- JavaScript vult alleen waarden in — het bouwt geen
  HTML-structuur

### Functies blijven klein
- Maximaal 20-25 regels per functie
- Als een functie groter wordt: splits op in kleinere
  functies met elk één verantwoordelijkheid
- Namen zijn beschrijvend: vulOpties(), leesGroepsGrootte(),
  slaWaardeOp() — niet genereerAlles()

### Geen bulk-operaties
- Voeg nooit meer dan 50 regels code toe in één wijziging
- Meer dan 50 regels = splitsen in aparte wijzigingen
- Elke wijziging heeft één doel

### Template patroon voor herbruikbare HTML
  In HTML:
  <template id="ronde-kaart-template">
    <div class="ronde-kaart">
      <!-- structuur hier -->
    </div>
  </template>

  In JavaScript:
  function renderRondeKaart(n) {
    const template = document.getElementById(
      'ronde-kaart-template');
    const clone = template.content.cloneNode(true);
    clone.querySelector('.ronde-nummer').textContent = n;
    return clone;
  }

### Scheiding van verantwoordelijkheden
- Structuur (wat er staat): mol-lesvorm.html
- Gedrag (wat er gebeurt): mol-js/ bestanden
- Stijl (hoe het eruit ziet): <style> in mol-lesvorm.html
- Data (wat er opgeslagen wordt): server.js + Supabase

## Maximale omvang per sessie

- Maximaal 3-4 wijzigingen per Claude Code sessie
- Meer dan 4 wijzigingen = splitsen in twee sessies
- Elke wijziging = één str_replace + één test +
  één commit
- Nooit een heel bestand herschrijven
- Nooit bulk-operaties zonder tussendoor te testen
