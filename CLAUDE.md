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
- **Handmatige stap voor Martijn (PowerShell, niet door de agent):**
  `git add . && git commit -m "beschrijving"`

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

## Handmatige stappen voor Martijn

Wanneer een ticket of instructie vraagt om stappen die Martijn zelf moet 
uitvoeren (bijv. dashboards openen, commando's draaien, instellingen 
wijzigen), schrijf dan:

- Per stap één concrete actie, genummerd
- Letterlijk uit te typen commando's in codeblokken
- Bij elke klik: waar precies klikken ("rechtsboven tandwiel" niet "settings")
- Verwachte tussentijdse uitkomst per stap ("je ziet nu X")
- Wat te doen als iets anders verschijnt dan verwacht

Martijn is een onervaren developer die leert door te doen. Ga uit van:
- Hij heeft geen parate kennis van CLI-tools, dashboards, of conventies
- Hij heeft geen Linux-ervaring — alle commando's moeten in PowerShell werken
- Hij kan fouten herstellen als hij begrijpt wat er gebeurt, niet als hij 
  alleen een commando kopieert zonder context

Liever te uitvoerig dan te beknopt. Vergelijking: schrijf zoals een goede 
IKEA-handleiding, niet zoals een man-page.

## Tooling-beperkingen (Cowork Edit/Write tools)

De Edit- en Write-tools knippen bestanden af als het doelbestand
emoji-tekens bevat (UTF-16 surrogate pair probleem). Het bestand lijkt
opgeslagen maar bevat daarna "Unexpected end of input" bij node --check.

**Aangetaste bestanden (bevatten emoji in broncode):**
- netlify-deploy/mol-js/docent-sessie.js
- netlify-deploy/mol-js/speler.js
- netlify-deploy/mol-lesvorm.html

**Regel: gebruik voor deze bestanden NOOIT Edit of Write.**
Gebruik altijd de Python str.replace() methode of een bash heredoc.

### Bestaand bestand wijzigen (str_replace via Python)

```python
python3 << 'ENDOFPYTHON'
path = 'netlify-deploy/mol-js/docent-sessie.js'
old  = '// exacte string die vervangen wordt'
new  = '// nieuwe string'
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()
assert old in src, f"FOUT: old_string niet gevonden in {path}"
with open(path, 'w', encoding='utf-8') as f:
    f.write(src.replace(old, new, 1))
print('OK')
ENDOFPYTHON
```

Of via het hulpscript `scripts/safe_replace.py` (zie dat bestand).

### Nieuw testbestand aanmaken (bash heredoc)

```bash
cat > tests/mijn-test.test.js << 'ENDOFFILE'
// @jest-environment jsdom
// ... testcode zonder emoji ...
// Vermijd emoji in test-assertions; gebruik .toContain() of
// expect.stringContaining() in plaats van letterlijke emoji-strings.
ENDOFFILE
```

### Emoji in test-assertions vermijden

```javascript
// FOUT — emoji in string triggert truncatie bij Write/Edit:
expect(result).toContain('🕵️ Mol');

// GOED — matcher zonder letterlijke emoji:
expect(result).toContain('Mol');
// of:
expect(result).toMatch(/Mol/);
```
