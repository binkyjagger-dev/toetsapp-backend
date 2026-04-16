// ── Auth ──────────────────────────────────────────────────────
let leraarToken  = localStorage.getItem('leraar_token') || null;
let leraarProfiel = null;

// ── Caches ───────────────────────────────────────────────────
let resultsCache    = [];
let classesCache    = [];
let lessonsCache    = [];

// ── Student flow ─────────────────────────────────────────────
let currentRole  = 'student';
let studentName = '';
let selectedClass = null;
let selectedLesson = null;
let chatMessages = [];
let questionCount = 0;
const MAX_QUESTIONS = 3;
let currentResultId = null;
let currentUnderstanding = 'matig';
let currentReflGoed = '';
let currentReflVerbeteren = '';
let opgavenData = null;
let studentScores = [];
let selectedLesvorm = 'socratisch';
let chatPhase = 'opening';
let socraticAnswerCount = 0;
let currentLeerdoelen = null;
let vraagLeerdoelen = [];

// ── Leerdoelen ───────────────────────────────────────────────
let alleLeerdoelen = [];
let ldImportBuffer = [];
let lesLdAlle       = [];
let lesLdGefilterd  = [];
let lesLdGeselecteerd = new Set();

// ── Lesvormen ────────────────────────────────────────────────
const LESVORMEN_REGISTRY = {

  'socratisch': {
    id:           'socratisch',
    naam:         'Socratisch gesprek',
    beschrijving: 'Voer een Socratisch gesprek over de lesstof en krijg per antwoord een score.',
    icoon:        '💬',
    duur:         '10–15 min',
    kleur:        'student',
    start:        () => { showScreen('screen-explain'); },
  },

  'mol': {
    id:           'mol',
    naam:         'Wie is de Mol?',
    beschrijving: 'Werk samen aan economische cases — maar pas op voor de saboteur in jouw groep.',
    icoon:        '🕵️',
    duur:         '25–40 min',
    kleur:        'red',
    start:        () => { window.open('mol-lesvorm.html?rol=speler', '_blank'); },
  },

};

let selectedLesvormen = ['socratisch'];
let lesvormMode       = 'locked';

// ── Navigatie ────────────────────────────────────────────────
let huidigView = 'klassen';
let huidigKlasId = null;
let huidigKlasTab = 'activiteiten';
let analyseData = null;

// ── Klas leerlingen ──────────────────────────────────────────
let klasLlKiezerAlle = [];
let klasLlKiezerGeselecteerd = new Set();
let _klasResultatenCache = [];
let alleLeerlingen = [];
let xlsxImportData = null;

// ── Klas modal ───────────────────────────────────────────────
let modalLlGeselecteerd = new Set();
let modalLlAlle = [];
let klasModalLlAlle = [];
let klasModalLlGeselecteerd = new Set();
let klasModalEditId = null;
