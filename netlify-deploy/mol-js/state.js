// ── Auth state ────────────────────────────────────────────
let docentToken = '';

// ── Sessie state ─────────────────────────────────────────
let sessieId    = null;
let sessieCode  = null;
let docentCode  = null;
let sessieState = null;
let lastRenderedFase = null;
let lastAutoAdvance = '';

// ── Speler state ─────────────────────────────────────────
let speler      = null;
let huidigeRondeNr = 1;
let testVerdachteId = null;
let testRondeNr     = null;
let testIngediend   = false;
let geselecteerdeOptie = null;
let geselecteerdeMcOptieId = null;
let geselecteerdeLidId = null;
let briefingGerenderd = false;
let briefingGedrukt = false;
let groepshoofGedrukt = false;
let feedbackRondeNr = 1;

// ── Setup state ──────────────────────────────────────────
let setupData   = {};
let groepsindeling = [];

// ── Hergebruik state ─────────────────────────────────────
let hergebruikGroepen = [];
let hergebruikSessieId   = null;
let hergebruikDocentCode = null;

// ── Timer state ──────────────────────────────────────────
let pollTimer   = null;
let heartbeatTimer = null;

// ── Picker state ─────────────────────────────────────────
let pickerGeselecteerd = new Set();
let pickerAlleeLeerlingen = [];
let pickerTargetTextarea = 'leerlingen-input';

// ── Cache ────────────────────────────────────────────────
let molLessenCache = [];
