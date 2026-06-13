import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "fitjaio.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

export function resetDb(db: Database.Database) {
  _db = db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL DEFAULT '',
      class_type TEXT NOT NULL,
      exercises TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      participants INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personal_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      exercises TEXT DEFAULT '',
      trainer_notes TEXT DEFAULT '',
      progress_notes TEXT DEFAULT '',
      muscle_groups TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS class_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_type TEXT NOT NULL,
      class_date TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'registered',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed historical data once — tracked via _meta so it never runs twice
  const seeded = db.prepare("SELECT value FROM _meta WHERE key='seeded'").get();
  if (!seeded) {
    seedHistory(db);
    db.prepare("INSERT INTO _meta (key, value) VALUES ('seeded', '1')").run();
  }
}

function seedHistory(db: Database.Database) {
  const ins = db.prepare(
    `INSERT INTO group_sessions (date, time, class_type, exercises, notes, participants)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const run = db.transaction(() => {
    // ── BODY SHAPE ──────────────────────────────────────────────────
    ins.run("2025-01-20", "10:00", "Body Shape", `ROZGRZEWKA:
step touch — ręce na zewnątrz, bujamy góra-dół
marsz przód-tył — na 4 kolano góra i skręt ciała
przeskok i dwa przysiady
wypad boczny na zmianę
przysiad, ręce do ziemi i wspięcie na palce, ręce w górze i kolano do łokcia x2 na zmianę
stanie na 1 nodze, ręce do boku jak motylek i uginamy nogę w kolanie

GŁÓWNA:
martwy ciąg z gumą na kostkach + biceps + odstawienie nogi tył z aktywacją pośladka
zakrok tył i hantle przód, najpierw 1 noga
helikopter w opadzie tułowia — hantle na zewnątrz, raz 1 ręka raz druga dół-góra
guma nad kolanami: przechodzenie do boku x3, przysiad

TRENING OBWODOWY:
ściąganie linek z wyciągu górnego (plecy)
TRX siedzac w siadzie skrzyżnym
rozkładanie się do dołu i powrót
biceps step 1 noga
rzut piłką + przeskok i podciągnięcie ketla z delikatnym przeskokiem
helikopter
wspinaczka przy ścianie (pompka z odepchnięciem od ściany) / wall ball
w opadzie tułowia hantle na zewnątrz — raz 1 ręka pracuje raz druga dół-góra
hantel zza głowy między proste nogi które odwodzimy
przysiad z dotknięciem skrzyni, duży ciężar
hip-thrust na stepie ze sztangą`, "BS 1 — 20.01 / 24.02 / 14.04", 12);

    ins.run("2025-01-27", "10:00", "Body Shape", `ROZGRZEWKA:
krążenia biodrami — ręce na zewnątrz
przysiad ręce góra V
wypad boczny — ręka przedłużeniem po skosie i ręka dół
wymach rąk góra i noga przód prosta na piętę, ręce tył i noga tył
mini przysiad na 1 nodze — krążenie biodrem do wypadu bocznego
razem z rękoma: sumo dotknięcie łydki, góra ręce przed siebie
zakrok i w dole wyciągnij bok
ze sklonu ziemy do deski i krążenie 1 i drugą ręką, powrót
bieg bokserski + skok do przysiadu i pajac
przysiad szeroki z hantlami

GŁÓWNA:
zakrok tył i hantle przód, najpierw 1 noga
helikopter w opadzie tułowia — hantle na zewnątrz, raz 1 ręka pracuje raz druga
guma nad kolanami: przechodzenie do boku x3, przysiad i puls
siedzac na piętach wypychamy biodra i 1 hantel triceps zza głowy z gumą
guma na kostkach: hantel zza głowy między proste nogi które odwodzimy
wchodzenie na skrzynię w tempie`, "BS 2 — 27.01 / 17.03 / 5.05", 10);

    ins.run("2025-02-03", "10:00", "Body Shape", `ROZGRZEWKA:
marsz na 3 — kolano góra i łokieć góra, jedna ręka prosta i delikatny podskok
podwójny step touch i ręka góra
odkręcanie biodra i wypad boczny
mini przysiad i dłonie przód i ręce triceps i pieta pośladek
mambo + ręka góra na zmianę
1-2-3 wykop, raz-dwa-trzy zakrok
sumo cały czas i delikatne wyjście w górę i ręka po skosie góra
step tył po skosie (mini narciarz) i łokcie na wysokość barków, ściągamy łopatki
zakrok w miejscu i hantel z ręką góra
wypad boczny

GŁÓWNA:
zakrok w miejscu i hantel bok
sumo puls 1x biceps na koniec w górze, sam biceps stojąc
1 duży hantel triceps x3 i hantel dół-góra
wyciskanie 1 noga na kolanie — 3x wyskanie hantle góra, 3x hantel z dołu bok
deska boczna z dużym hantlem na udzie`, "BS 3 — 3.02 / 24.03", 11);

    ins.run("2025-02-10", "10:00", "Body Shape", `ROZGRZEWKA (z gumą):
step touch hantle góra z mini przysiadami, wydłużenie góra
kolano-łokieć, prosta ręka do prostej nogi
kolano góra z przeskokiem, łokieć do kolana
koło biodrem i wypad boczny

Z GUMĄ NA KOSTKACH:
step out + triceps
pajacyk
przysiad i 3x lift bok
lift gumy bok i tył + biceps (po 20s)

GŁÓWNA:
sumo + wysunięcie hantli, samo w dole zatrzymaj, puls rekami dół i góra
sumo z większym ciężarem — wolno-szybko góra, potem zamiana hantle na mniejsze, zostajemy w dole i wysuwamy ręce
przysiad wąski w dole — puls
zakrok w miejscu i hantel z ręką góra, wypad boczny`, "BS 4 — 10.02 / 31.03", 13);

    ins.run("2025-02-16", "10:00", "Body Shape", `ROZGRZEWKA:
duży hantel góra i kolano góra i skręt ciała
w opadzie tułowia rozpiętka i wiosło — hantle w dłoniach odwróconych

GŁÓWNA:
przysiad hantel dół
zakrok noga tył i hantel góra
deska — przekładanie hantla lewo i prawo i wiosło pojedyncze hantlem
deska i hantel w górę, otwieramy klatkę, druga strona przysiadu i wykroku
wznosy bioder z gumą i wyciskanie 1 hantle góra, drugi hantel na biodrach, potem 2 hantle w ręce
dupa w górze i samowyciskanie hantli i odwodzenie gumy
klek podparty pompka`, "BS 5 — 16.02 / 7.04", 9);

    ins.run("2025-04-28", "10:00", "Body Shape", `ROZGRZEWKA:
zakrok w miejscu i hantel bok

GŁÓWNA:
sumo puls 1x biceps na koniec w górze, sam biceps stojąc
1 duży hantel triceps x3 i hantel dół-góra
wyciskanie 1 noga na kolanie, 3x wyskanie hantle góra, 3x hantel z dołu bok
deska boczna z dużym hantlem na udzie

TRENING OBWODOWY:
wejście na skrzynię nogami
pompka mini, zejście
przysiad hantle góra
rower — ściąganie hantli dół kąt 90° i kolano góra z gumą na stopie
TRX leżymy na ławce, kostka pod pośladkami, opuszczamy nogę dół-góra
przysiad na BOSU i boks w worek`, "BS 6 — 28.04", 10);

    // ── WALK CORE ───────────────────────────────────────────────────
    ins.run("2025-01-15", "09:00", "Walk Core", `ROZGRZEWKA:
step touch — ręce na zewnątrz i bujamy góra-dół
do sumo — ręce na zewnątrz i dotykamy łydki
mocne skosy
przeskok i dwa przysiady
wypad boczny i 3 podskoki
marsz, przysiad — ręce do ziemi i skok w bok
ręce w górze i kolano do łokcia x2 na zmianę
nożyce x3 i wykop nogi na zmianę
łokieć do kolana po skosie i łączymy: stopy razem i potem na zewnątrz (do pajaca)

GŁÓWNA:
łączymy hantle na wysokości klatki schodząc do przysiadu
hantle przód i odrywamy na zmianę — jakby w marszu, piętę i góra hantle po skosie
biceps + kolano do łokcia w przysiadzie
hantle góra, odkładamy je jak najdalej i podskakujemy do hantli — tak cały czas
3 odwodzenia siedzac na ławce — stopy na ziemi i kolana góra
wchodzenie na skrzynię w tempie`, "WC 1 — 15.01 / 5.03 / 16.04", 15);

    ins.run("2025-01-22", "09:00", "Walk Core", `ROZGRZEWKA:
idziemy przód i tył, ręce pracują
noga przód i tył
ściągnij łopatkę i noga prosta, ręce przód i noga wykop
kolano do łokcia z delikatnym podskokiem
przysiad i ręka po skosie
zakrok po skosie i jeden łokieć kąt 90° góra

GŁÓWNA:
biceps + kolano góra bez odkładania
step T i triceps zza głowy
hantle złożone — przysiad, wspięcie na palce i kopnięcie po skosie do ręki
marsz i hantle lewo-prawo góra-dół

Z GUMĄ:
przysiad
wypad boczny
przysiad i lift drugiej nogi bok
guma nad kolanami 1-2-3 podskoki`, "WC 2 — 22.01 / 19.03", 14);

    ins.run("2024-12-18", "09:00", "Walk Core", `ROZGRZEWKA:
idziemy przód i tył, ręce pracują
noga przód i tył
ściągnij łopatkę i noga prosta, ręce przód i noga wykop
kolano do łokcia z delikatnym podskokiem
przysiad i ręka po skosie
zakrok po skosie i 1 łokieć kąt 90° góra
biceps i kolano góra bez odkładania
step T i triceps zza głowy

GŁÓWNA:
hantle złożone — przysiad, wspięcie na palce i kopnięcie po skosie do ręki
marsz i hantle lewo-prawo góra-dół

Z GUMĄ:
przysiad
wypad boczny
przysiad i lift drugiej nogi bok
guma nad kolanami 1-2-3 podskoki`, "WC 3 — 18.12 / 26.03", 12);

    ins.run("2025-01-29", "09:00", "Walk Core", `ROZGRZEWKA:
dotknij hantle pięty i potem ręce do pajaca
kolano góra
przysiad przez step out i klaskanie hantlami wyżej
przysiad puls i boks hantle przód

GŁÓWNA:
przysiad — zrzucamy hantle między nogi i na zewnątrz w dół x2 i 2x kolano do łokcia
hantle prostej ręki po skosie do prostej nogi (opcja z przeskokiem)
T i hantle złączone razem — triceps po 2x
kolano góra, prosta ręka po skosie — boks i przeciwna noga kolano góra
przysiad hantle dół i wspięcie na palce z mini wyskokiem
zakrok i kopnięcie`, "WC 4 — 29.01 / 2.04", 13);

    ins.run("2025-04-09", "09:00", "Walk Core", `ROZGRZEWKA:
marsz — krążenia barkami przód-tył
2x noga bok i łokcie góra
step out i triceps
skrętosklony z hantlami
3 szybkie kolana
2 małe podskoki z kolan do przysiadu i podskok
narciarz z przeskokiem i kolano w górze

GŁÓWNA:
sumo przysiad — ręce cały czas ok góra i wspięcie na palce i skręt do zakroku i ręka prosta bok
w biegu stopa przód i ręce boks
schodzimy do kolan — nad matę

Z GUMĄ:
w przysiadzie odstawiamy nogę bok raz jedna raz druga
góra wspięcie na palce 2x nogi razem`, "WC 5 — 9.04", 11);

    // ── POŚLADKI I BRZUCH ────────────────────────────────────────────
    ins.run("2025-01-15", "11:00", "Pośladki i Brzuch", `ROZGRZEWKA:
zakrok i talerz góra i kolano góra
w przysiadzie koło talerzem

Z GUMĄ NA KOSTKACH:
w półprzysiadzie odstawiamy nogę bok
w leżeniu bokiem z gumą unosimy nogę
w leżeniu na brzuchu z gumą odkładamy nogę do boku, potem dwie naraz

BRZUCH:
w desce odkładamy kolano do maty
z ugiętymi kolanami podwijamy i odrywamy miednicę
nożyce góra-dół z oderwanymi barkami

ROZGRZEWKA (23.04):
pajacyk
przód-tył z rotacją bioder
guma na bucie`, "PiB 1 — 15.01 / 23.04", 12);

    ins.run("2025-01-22", "11:00", "Pośladki i Brzuch", `GŁÓWNA:
przysiad prosty z ciężkim ketlem albo hantlem
odkładamy za pięty — wolno dół, szybko góra
przerzucanie hantla w dole i zakrok w tył noga na zmianę
(NA KONIEC: przytrzymanie i 5x razy, druga ręka unoszenie w górę)
kolano do łokcia z hantlem w klęku na przedramionach

Z GUMĄ:
1 guma na bucie, druga na kostce — robimy lift nogi w tył jakbyśmy chciały przepychać ścianę
w odwróconym podporze na rękach — pośladki dół i góra i u góry odwodzenie z gumą

Z PIŁKĄ MIĘDZY KOLANAMI:
kolana nad matę`, "PiB 2 — 22.01 / 19.03", 11);

    ins.run("2025-01-29", "11:00", "Pośladki i Brzuch", `ROZGRZEWKA:
szeroki przysiad i 1 noga w bok i ręka zamach i skręt biodra x2
2x kolano góra i hantle bokiem góra, dłoń otwarta
swing i ręce po skosie na zmianę góra
przysiad sumo i unosimy piętę plus ręka przód
martwy ciąg na 1 nodze i lift drugiej nogi tył
noga bok i zrzucanie 1 hantla dół
kolano góra i klatka dół z hantlami dół i odstawiamy nogę i prostujemy klatkę
ręce pajacyk i 3 kroki przód kolano góra i 3 kroki tył piętą o pośladek
nogi szeroko-wąsko

GŁÓWNA (26.03):
kontynuacja powyższych ćwiczeń z progresją ciężarów`, "PiB 3 — 29.01 / 26.03", 13);

    ins.run("2025-02-12", "11:00", "Pośladki i Brzuch", `ROZGRZEWKA Z GUMĄ:
step touch — noga przód po skosie, hantle dół po skosie
wypchniecie bioder + rozpiętka ręce góra, noga tył x2 na zmianę
krzyżujemy ręce z przodu i ściągamy łokcie 90° tył i lift nogi bok
przysiad skok i biceps
pajacyk i noga cały czas lift bok w powietrzu
idziemy 3 kroki przód po skosie i tył ręka bark góra

GŁÓWNA:
wstajemy z kolan do zakroku i 1 puls w dole a hantle góra
przysiad na 1 nodze (jak będzie dobrze szło 1 ręka w górę)`, "PiB 4 — 12.02 / 2.04", 10);

    ins.run("2025-02-19", "11:00", "Pośladki i Brzuch", `GŁÓWNA:
przysiad z gumą i lift tył i lift bok x8
zakroki chodzone przy ścianie z gumą na łydkach — lift nogi tył
hip-thrust na wałku — ręka tył na zmianę, potem noga przód, i na koniec same wznosy bioder

15 MIN TABATA (po 30s):
na wałku bez gumy — nożyce pionowe wolno, potem szybko, potem piętą na zmianę do ziemi
z gumą — nogi delikatnie dół i odwodzenie gumy
z odwiedzioną gumą — nogi dół-góra

ROZCIĄGANIE Z WAŁKIEM`, "PiB 5 — 19.02 / 16.04", 12);
  });

  run();
  console.log("Seeded 16 historical group sessions from training history.");
}
