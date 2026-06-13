import { getDb } from "./db";

const SEED: Array<{
  date: string; time: string; class_type: string;
  exercises: string; notes: string; participants: number;
}> = [
  {
    date: "2025-01-20", time: "10:00", class_type: "Body Shape", participants: 12,
    exercises: "Rozgrzewka: step touch, marsz przód-tył, kolano góra, przeskok+2 przysiady, wypad boczny na zmianę, przysiad ręce do ziemi+wspięcie na palce, kolano do łokcia x2\nGłówna: martwy ciąg z gumą na kostkach+biceps+odstawienie nogi tył, ściąganie linek górny wyciąg plecy, TRX siad skrzyżny, leżenie do dołu i powrót, biceps step 1 noga, rzut piłką z przeskokiem, podciąganie ketla, helikopter w opadzie tułowia, wspinaczka przy ścianie/pompka od ściany, wall ball, w opadzie tułowia hantle na zewnątrz, hantel zza głowy między proste nogi",
    notes: "BS 1 - 20.01",
  },
  {
    date: "2025-01-27", time: "10:00", class_type: "Body Shape", participants: 10,
    exercises: "Rozgrzewka: krążenia biodrami, przysiad ręce góra V, wypad boczny ręka po skosie, wymach rąk+noga przód, mini przysiad na 1 nodze krążenie biodrem, sumo dotknięcie łydki, zakrok+wyciągnij bok, ze sklonu do deski i krążenia ręką\nGłówna: bieg bokserski skok do przysiadu+pajac, przysiad szeroki z hantlami, zakrok tył+hantle przód (najpierw 1 noga), helikopter w opadzie tułowia, wchodzenie na skrzynię w tempie",
    notes: "BS 2 - 27.01",
  },
  {
    date: "2025-02-03", time: "10:00", class_type: "Body Shape", participants: 11,
    exercises: "Rozgrzewka: marsz na 3 kolano góra, podwójny step touch+ręka góra, odkręcanie biodra+wypad boczny, sumo+delikatne wyjście w górę+ręka po skosie, step tył po skosie (mini narciarz), zakrok w miejscu+hantel z ręką góra\nGłówna: sumo cały czas+delikatne wyjście w górę+ręka po skosie, step tył po skosie łokcie na wysokość barków ściągamy łopatki, zakrok w miejscu+hantel z ręką góra, wypad boczny",
    notes: "BS 3 - 3.02",
  },
  {
    date: "2025-02-10", time: "10:00", class_type: "Body Shape", participants: 13,
    exercises: "Rozgrzewka z gumą: step touch hantle góra+mini przysiad, kolano-łokieć prosta ręka do prostej nogi, kolano góra+przeskok łokieć do kolana, koło biodrem+wypad boczny\nZ gumą na kostkach: step out+triceps, pajacyk, przysiad+3x lift bok, lift gumy bok i tył+biceps\nGłówna: sumo+wysunięcie hantli wolno dół/puls rekami, sumo z większym ciężarem wolno-szybko góra",
    notes: "BS 4 - 10.02",
  },
  {
    date: "2025-02-16", time: "10:00", class_type: "Body Shape", participants: 9,
    exercises: "Rozgrzewka: duży hantel góra+kolano góra+skręt ciała, w opadzie tułowia rozpiętka i wiosło\nGłówna: przysiad hantel dół, zakrok noga tył+hantel góra, deska przekładanie hantla lewo-prawo, wiosło pojedyncze hantlem, deska+hantel w górę otwieramy klatkę, wznosy bioder z gumą+wyciskanie 1 hantle góra, klek podparty pompka",
    notes: "BS 5 - 16.02",
  },
  {
    date: "2025-04-28", time: "10:00", class_type: "Body Shape", participants: 10,
    exercises: "Rozgrzewka: zakrok w miejscu+hantel bok\nGłówna: sumo puls+biceps na końcu w górze, 1 duży hantel triceps x3+hantel dół-góra, wyciskanie 1 noga na kolanie 3x, hantel z dołu bok, deska boczna z dużym hantlem na udzie\nObwodowy: wejście na skrzynię nogami, pompka mini, zejście, przysiad hantle góra, rower ściąganie hantli dół 90°+kolano góra z gumą na stopie, TRX leżenie na ławce kostka pod pośladkami opuszczamy nogę, przysiad na BOSU+boks w worek",
    notes: "BS 6 - 28.04",
  },
  {
    date: "2025-01-15", time: "09:00", class_type: "Walk Core", participants: 15,
    exercises: "Rozgrzewka: step touch ręce na zewnątrz+bujamy, sumo ręce na zewnątrz dotykamy łydki, mocne skosy, przeskok+2 przysiady, wypad boczny+3 podskoki, marsz przysiad ręce do ziemi+skok w bok, nożyce x3+wykop nogi, łokieć do kolana po skosie\nGłówna: łączenie hantli na wys. klatki schodząc do przysiadu, hantle przód odrywamy na zmianę jak w marszu, pięty góra hantle po skosie",
    notes: "WC 1 - 15.01",
  },
  {
    date: "2025-01-22", time: "09:00", class_type: "Walk Core", participants: 14,
    exercises: "Rozgrzewka: idziemy przód i tył ręce pracują, noga przód i tył, ściągnij łopatkę+noga prosta+ręce przód, wykop kolano do łokcia z delikatnym podskokiem, przysiad+ręka po skosie, zakrok po skosie+łokieć 90° góra, biceps+kolano góra bez odkładania, step T+triceps zza głowy\nZ gumą: przysiad, wypad boczny, przysiad+lift drugiej nogi bok, guma nad kolanami 1-2-3 podskoki",
    notes: "WC 2 - 22.01",
  },
  {
    date: "2024-12-18", time: "09:00", class_type: "Walk Core", participants: 12,
    exercises: "Rozgrzewka: idziemy przód-tył ręce pracują, noga przód i tył, ściągnij łopatkę+noga prosta+ręce przód i wykop, kolano do łokcia z delikatnym podskokiem, przysiad+ręka po skosie, zakrok po skosie+1 łokieć 90° góra\nGłówna: biceps+kolano góra bez odkładania, step T+triceps zza głowy, hantle złożone przysiad+wspięcie+kopnięcie po skosie, marsz+hantle lewo-prawo góra-dół\nZ gumą: przysiad, wypad boczny, przysiad+lift nogi bok",
    notes: "WC 3 - 18.12",
  },
  {
    date: "2025-01-29", time: "09:00", class_type: "Walk Core", participants: 13,
    exercises: "Rozgrzewka: dotknij hantle pięty+pajac, kolano góra, przysiad przez step out+klaskanie hantlami wyżej, przysiad puls+boks hantle przód\nGłówna: przysiad zrzucamy hantle między nogi+na zewnątrz dół x2+2x kolano do łokcia, hantle prostej ręki po skosie do prostej nogi (opcja z przeskokiem), T+hantle złączone triceps po 2x kolano góra, prosta ręka po skosie boks+przeciwna noga kolano góra",
    notes: "WC 4 - 29.01",
  },
  {
    date: "2025-04-09", time: "09:00", class_type: "Walk Core", participants: 11,
    exercises: "Rozgrzewka: marsz krążenia barkami przód-tył, 2x noga bok+łokcie góra, step out+triceps, skrętosklony z hantlami, 3 szybkie kolana, 2 małe podskoki z kolan do przysiadu+podskok, narciarz z przeskokiem+kolano w górze\nGłówna: sumo przysiad ręce góra+wspięcie+skręt do zakroku+ręka prosta bok, w biegu stopa przód+ręce boks, schodzimy do kolan\nZ gumą: w przysiadzie odstawiamy nogę bok+góra wspięcie na palce 2x nogi razem",
    notes: "WC 5 - 9.04",
  },
  {
    date: "2025-01-15", time: "11:00", class_type: "Pośladki i Brzuch", participants: 12,
    exercises: "Rozgrzewka: zakrok+talerz góra+kolano góra, w przysiadzie koło talerzem\nZ gumą na kostkach: w półprzysiadzie odstawiamy nogę bok, w leżeniu bokiem unosimy nogę, w leżeniu na brzuchu z gumą odkładamy nogę do boku+dwie naraz\nBrzuch: w desce odkładamy kolano do maty, z ugiętymi kolanami podwijamy+odrywamy miednicę, nożyce góra-dół z oderwanymi barkami",
    notes: "PiB 1 - 15.01",
  },
  {
    date: "2025-01-22", time: "11:00", class_type: "Pośladki i Brzuch", participants: 11,
    exercises: "Główna: przysiad prosty z ciężkim ketlem/hantlem odkładamy za pięty wolno dół-szybko góra, przerzucanie hantla w dole+zakrok tył noga na zmianę (na końcu przytrzymanie+5x raz druga ręka unoszenie w górę), kolano do łokcia z hantlem w klęku na przedramionach\nZ gumą: 1 guma na bucie 1 na kostce lift nogi tył, w odwróconym podporze pośladki dół-góra+odwodzenie\nZ piłką między kolanami: kolana nad matę",
    notes: "PiB 2 - 22.01",
  },
  {
    date: "2025-01-29", time: "11:00", class_type: "Pośladki i Brzuch", participants: 13,
    exercises: "Rozgrzewka: szeroki przysiad+1 noga w bok+ręka zamach+skręt biodra x2, 2x kolano góra+hantle bokiem góra dłoń otwarta, swing+ręce po skosie na zmianę, sumo przysiad+unosimy piętę+ręka przód, martwy ciąg na 1 nodze+lift drugiej tył\nGłówna: noga bok+zrzucanie 1 hantla dół, kolano góra+klatka dół z hantlami+odstawiamy nogę+prostujemy klatkę, ręce pajacyk+3 kroki przód kolano góra+3 kroki tył piętą o pośladek, nogi szeroko-wąsko",
    notes: "PiB 3 - 29.01",
  },
  {
    date: "2025-02-12", time: "11:00", class_type: "Pośladki i Brzuch", participants: 10,
    exercises: "Rozgrzewka z gumą: step touch noga przód po skosie hantle dół po skosie, wypchniecie bioder+rozpiętka ręce góra noga tył x2 na zmianę, krzyżujemy ręce+ściągamy łokcie 90°+lift nogi bok, przysiad skok+biceps, pajacyk+noga cały czas lift bok w powietrzu, 3 kroki przód po skosie i tył ręka bark góra\nGłówna: wstajemy z kolan do zakroku+1 puls w dole+hantle góra, przysiad na 1 nodze (jak idzie dobrze 1 ręka w górę)",
    notes: "PiB 4 - 12.02",
  },
  {
    date: "2025-02-19", time: "11:00", class_type: "Pośladki i Brzuch", participants: 12,
    exercises: "Główna: przysiad z gumą+lift tył+lift bok x8, zakroki chodzone przy ścianie z gumą na łydkach lift nogi tył, hip-thrust na wałku ręka tył na zmianę+noga przód+same wznosy bioder\n15 min tabata (30s): na wałku bez gumy nożyce pionowe wolno/szybko+piętą na zmianę do ziemi, z gumą nogi delikatnie dół+odwodzenie, z odwiedzioną gumą nogi dół-góra\nRozciąganie z wałkiem",
    notes: "PiB 5 - 19.02",
  },
];

export function seedIfEmpty() {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM group_sessions").get() as { n: number }).n;
  if (count === 0) {
    const insert = db.prepare(
      "INSERT INTO group_sessions (date, time, class_type, exercises, notes, participants) VALUES (?,?,?,?,?,?)"
    );
    const many = db.transaction(() => {
      for (const s of SEED) {
        insert.run(s.date, s.time, s.class_type, s.exercises, s.notes, s.participants);
      }
    });
    many();
    console.log(`Seeded ${SEED.length} historical group sessions.`);
  }
}
