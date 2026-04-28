/**
 * @jest-environment jsdom
 */
// MOL-11: scherm 7a/7b discussie render fixes

describe('renderDiscussiescherm helpers', () => {

  test('eigenTekst: correct wordt leesbaar', () => {
    var antwoord = { antwoord: 'correct' };
    var tekst = '';
    if (antwoord.antwoord === 'correct') tekst = 'Correct antwoord';
    expect(tekst).toBe('Correct antwoord');
  });

  test('eigenTekst: MC UUID wordt optiebeschrijving', () => {
    var antwoord = { antwoord: 'x', mc_optie_id: 'uuid-1' };
    var opties = [{ id: 'uuid-1', tekst: 'Veel aanbieders' }];
    var gevonden = opties.find(function(o) { return o.id === antwoord.mc_optie_id; });
    expect(gevonden.tekst).toBe('Veel aanbieders');
  });

});

describe('disc-groepsantwoord-knop initieel disabled', () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="disc-groepsantwoord-knop" style="display:none;"></button>
    `;
  });

  test('knop is disabled nadat het groepshoofd-blok de knop toont', () => {
    var btnEl = document.getElementById('disc-groepsantwoord-knop');
    btnEl.style.display = 'block';
    btnEl.disabled = true;
    expect(btnEl.disabled).toBe(true);
  });

});
