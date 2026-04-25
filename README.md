<p align="center">
  <img src="public/logo-clean.png" alt="AlphaAi Accounting" width="200" />
</p>

<h1 align="center">AlphaFlow</h1>

<p align="center">
  <strong>Intelligent Skat & Moms for moderne virksomheder</strong><br/>
  Et moderne, webbaseret regnskabsprogram bygget specifikt til danske småvirksomheder — med fuld overholdelse af dansk Bogføringslov.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Bun-Runtime-F9A825?logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/License-Privat-6C6C6C" alt="Licens" />
</p>

---

## Introduktion

**AlphaAi Accounting** er et moderne, webbaseret regnskabsprogram, der er bygget specielt til danske småvirksomheder. Programmet giver dig et komplet værktøj til at håndtere din virksomheds økonomi — fra den daglige bogføring til den årlige årsafslutning og alt derimellem. Alt sammen samlet i ét overskueligt system, som du kan tilgå direkte fra din webbrowser, uden at du behøver installere noget på din computer.

Programmet dækker hele bogføringscyklussen — fra registrering af transaktioner og håndtering af fakturaer, over dobbeltpostering og bankafstemning, til økonomisk rapportering, årsafslutning og regulatorisk eksport (SAF-T / OIOUBL Peppol). Alle ændringer logges automatisk i et uforanderligt revisionsspor, og data slettes kun via soft-delete i overensstemmelse med dansk bogføringslov.

Applikationen er en **Progressiv Web App (PWA)**, der kan installeres på din computer eller telefon. Den understøtter både dansk og engelsk brugerflade, lyst og mørkt tema, og fungerer også offline med automatisk caching.

---

## Hvem er programmet lavet til?

AlphaAi Accounting er skabt med tanke på **iværksættere, freelancere og små virksomhedsejere**, der har brug for et pålideligt regnskabssystem, men som ikke nødvendigvis har en baggrund i bogholderi eller økonomi. Det betyder, at brugerfladen er designet til at være intuitiv og let at forstå, samtidig med at de avancerede funktioner er tilgængelige, når du har brug for dem.

Systemet er en **single-tenant applikation** — hver bruger har sit eget fuldt isolerede regnskab med egne konti, transaktioner, fakturaer og indstillinger. Om du driver en enkeltmandsvirksomhed, en mindre håndværksvirksomhed eller en konsulentvirksomhed, kan AlphaAi Accounting tilpasses dine behov.

---

## Hvad kan systemet?

| Funktion | Beskrivelse |
|---|---|
| **Dobbelt bogføring** | Fuld dobbeltposteringsmodel med automatisk debit/kredit-validering, som danske revisorer og myndigheder forventer |
| **Kontoplan** | Standard dansk kontoplan med 35 konti efter FSR-standarden (Foreningen af Statsautoriserede Revisorer) + mulighed for tilpassede konti |
| **Fakturering** | Opret, send og hold styr på fakturaer med linjeposter, automatisk momsberigning, sekvensnummerering og PDF-generering |
| **Momsafregning** | Beregner automatisk udgående og indgående moms med 10 danske momskoder (S25, S12, S0, SEU, K25, K12, K0, KEU, KUF, NONE) |
| **Kunde- og leverandørstyring** | Opret og vedligehold kunder og leverandører med CVR-numre, kontaktoplysninger og notater |
| **Rapportering** | Resultatopgørelse, balance, hovedbog (proveliste), aldersopdelte rapporter og likviditetsopgørelse |
| **Eksport til myndigheder** | Generér SAF-T-filer til Skattestyrelsen og OIOUBL/Peppol e-fakturaer med forhåndsvalidering |
| **Bankafstemning** | Import af kontoudtog med automatisk matchning mod bogførte posteringer |
| **Budgettering** | Planlæg dit regnskabsår med månedlige budgetter pr. konto med faktisk-vs-budget sammenligning |
| **Årsafslutning** | Guidet årsafslutning der nulstiller resultatkonti og låser alle perioder automatisk |
| **Gentagende posteringer** | Automatisér faste betalinger (leje, abonnementer, forsikring) med skabeloner og fleksible frekvenser |
| **Bilagsscanning (OCR)** | Indbygget kvitteringsscanning med Tesseract.js — uddrager automatisk beløb, dato og momsprocent |
| **Backup** | Automatiske sikkerhedskopier med SHA-256 verifikation og opbevaring i op til 5 år |
| **Revisionsspor** | Uforanderlig audit-log der registrerer alle ændringer med tidsstempel, bruger og før/efter-værdier |

---

## Overholdelse af dansk bogføringslov

AlphaAi Accounting er udviklet med fuld overholdelse af den danske **Bogføringslov**. Dette betyder blandt andet:

- **Revisionsspor** (Bogføringsloven §10–12) — Alle ændringer registreres med tidsstempel, bruger og ændringsdetaljer. Revisionssporet kan aldrig slettes eller ændres (immutable).
- **Soft delete** (Bogføringsloven §4–8) — Finansposteringer og fakturaer slettes aldrig fysisk. De markeres som "annulleret" med årsag, men forbliver i systemet af hensyn til revisionssporing.
- **Regnskabsperioder** — Perioder kan låses, så der ikke kan bogføres på lukkede perioder. Låsning afvises, hvis der findes kladder i perioden.
- **Opbevaringspligt** (Bogføringsloven §15) — Backup-systemet opbevarer data i op til 60 måneder (5 år), svarende til den danske opbevaringspligt.
- **Officielle formater** — SAF-T (Danish Financial Schema v1.0) og OIOUBL/Peppol (BIS Billing 3.0) genereres i de formater, som Skattestyrelsen kræver.

---

## Kom godt i gang

### Forudsætninger

- **[Bun](https://bun.sh/)** v1.3+ — eneste runtime, pakkehåndtering og scriptkører
- **[Git](https://git-scm.com/)** — til kloning af repository

> **Ingen andre afhængigheder, miljøvariabler eller konfiguration er nødvendige.** SQLite-databasen oprettes automatisk ved første kørsel.

### Hurtig Start

```bash
# 1. Klon repository
git clone https://github.com/Onezandzeroz/AlphaAi-Accounting.git
cd AlphaAi-Accounting

# 2. Installer afhængigheder (genererer Prisma Client automatisk)
bun install

# 3. Initialiser databasen
bun run db:push

# 4. Start udviklingsserveren
bun run dev
```

Applikationen er tilgængelig på **http://localhost:3000**.

### Første skridt

Når du har oprettet en konto og logget ind, anbefales følgende opsætningsrækkefølge:

1. **Opret kontoplan** — Klik på "Kontoplan" → "Opret standard dansk kontoplan". Dette opretter 35 standardkonti efter FSR-standarden (aktiver, passiver, egenkapital, indtægter og udgifter).
2. **Tilføj firmaprofil** — Gå til "Indstillinger" og udfyld virksomhedens navn, adresse, CVR-nummer, bankoplysninger og fakturaindstillinger. Disse oplysninger bruges på fakturaer og officielle eksporter.
3. **Opret kontakter** — Tilføj dine kunder og leverandører under "Kontakter". Kontakter kan tildeles typen Kunde, Leverandør eller Begge.
4. **Registrér første postering** — Opret en transaktion eller finansjournalpost og begynd at bogføre.

Du kan også vælge at **indlæse demo-data** fra dashboardet. Dette opretter realistisk eksempeldata (virksomhed, kontakter, transaktioner, fakturaer, finansejournaleposter og perioder), så du kan udforske alle funktioner uden at indtaste rigtige data.

---

## Moduloversigt

Programmet er organiseret i fem overskuelige afsnit i sidemenuen. Her er en gennemgang af alle moduler og deres funktioner.

### 📂 Daglig Drift

#### Dashboard — Dit kontrolpanel

Dashboardet er det første, du ser, når du logger ind. Det fungerer som dit centrale kontrolpanel og giver et hurtigt overblik over din virksomheds økonomiske tilstand:

- **Nøgletal** — Omsætning, nettoresultat, udgående moms, indgående moms, egenkapital og aktiver vises som opdaterede kort.
- **Diagrammer** — Søjlediagram med indtægter vs. udgifter over tid, og kagediagram med momsfordeling.
- **Seneste posteringer** — Liste over de seneste bogførte finansejournaleposter.
- **Hurtige handlinger** — Direkte genveje til at oprette posteringer, fakturaer eller se rapporter.
- **Onboarding-guide** — Hvis du endnu ikke har nogen data, vises en trin-for-trin guide til at komme i gang.

Når du har bogførte data med dobbeltpostering, udvides dashboardet automatisk med resultatopgørelse, balance og topkonti.

#### Transaktioner — Registrér salg og køb

Transaktionsmodulet lader dig hurtigt registrere salg og køb med automatisk momsberigning:

- Opret transaktioner med type (salg, køb, løn, bank), dato, beløb, beskrivelse og momsprocent.
- **Flervaluta** — Understøtter DKK, EUR, USD, GBP, SEK og NOK med valutakurs og DKK-ækvivalent.
- **OCR-kvitteringsscanning** — Tag et billede af en kvittering; systemet uddrager automatisk beløb, dato og momsprocent (dansk og engelsk).
- Upload kvitteringsbilleder linket til transaktionen.
- Transaktioner annulleres aldrig permanent — de markeres som "annulleret" med årsag.
- Eksportér alle transaktioner til CSV med netto/moms/bruto-opdeling og summer.

#### Fakturering — Opret og send fakturaer

Fakturamodulet giver dig mulighed for at oprette, sende og administrere alle dine fakturaer:

- Opret fakturaer med linjeposter (beskrivelse, antal, enhedspris, momsprocent).
- Systemet beregner automatisk subtotal, momsbeløb og totalbeløb.
- Fakturaer får automatisk sekvensnummer (`PRÆFIKS-ÅR-SEKVENS`).
- **Status-workflow** — `KLADDE → SENDT → BETALT / ANNULLERET`. Markering som "betalt" opretter automatisk linkede salgstransaktioner.
- **PDF-download** — Generér professionel A4 PDF med firmalogo, bankoplysninger og danske etiketter.
- **OIOUBL/Peppol eksport** — Generér Peppol BIS Billing 3.0-kompatibel e-faktura XML med forhåndsvalidering.
- Filtér efter status for at se hvilke fakturaer der venter på betaling.

#### Kontakter — Styr kunder og leverandører

Kontaktmodulet er dit mini-CRM-system, hvor du samler alle oplysninger om kunder og leverandører:

- Registrér navn, CVR-nummer, e-mail, telefon, adresse, by, postnummer og land.
- Tildel kontakttype: Kunde, Leverandør eller Begge.
- Søg og filtrer efter navn, CVR-nummer eller kontakttype.
- Kontakter linkes direkte til fakturaer — kundeoplysninger udfyldes automatisk.
- Tilføj notater med aftaler, betalingsbetingelser m.m.

#### Gentagende Posteringer — Automatisér faste betalinger

Opret skabeloner for udgifter eller indtægter, der gentager sig med faste mellemrum:

- Fem frekvenser: dagligt, ugentligt, månedligt, kvartalsvis, årligt.
- Statusstyring: Aktiv, Pauset eller Fuldført.
- Et-klik eksekvering opretter en bogført finansejournalpost og rykker automatisk næste udførelsesdato.
- Spar tid på faste udgifter som husleje, abonnementer, forsikring og lønninger.

### 📂 Bogføring & Regnskab

#### Finansjournal — Dobbelt bogføring af transaktioner

Finansjournalen er hjertet i dit regnskab. Her bogfører du alle økonomiske transaktioner ved hjælp af dobbelt bogføring:

- Hver postering består af mindst to linjer — en debitlinje og en kreditlinje.
- Systemet validerer automatisk, at debet og kredit er i balance (±0,005 tolerance).
- **Tre statuser**: Kladdé (kan redigeres frit), Bogført (låst og indgår i rapporter), Annulleret (beholdt i systemet af hensyn til revisionssporing).
- Hver linje kan tildeles en momskode for præcis momssporing.
- Filtrer efter status, datointerval og søgeord.
- Kun kladdé-posteringer kan redigeres eller annulleres.

#### Kontoplan — Fundamentet for dit regnskab

Kontoplanen bestemmer, hvordan indtægter, udgifter, aktiver og forpligtelser kategoriseres:

- Standard dansk kontoplan med 35 konti fordelt på 5 typer og 18 grupper.
- Systemkonti (markeret som "system") kan ikke slettes ved en fejl.
- Tilføj egne konti med danske og engelske navne.
- Se oversigt grupperet efter type og gruppe.

#### Hovedbog — Se alle konti og deres saldi

Hovedbogen (provelisten) giver et komplet overblik over alle konti og deres aktuelle saldi:

- Samlet debitbeløb, kreditbeløb og saldo for hver konto.
- Grupperet efter kontotype (aktiver, passiver, egenkapital, indtægter, udgifter).
- Bekræfter, at dobbelt bogføringen er i balance (debit = kredit).
- Filtrer efter datointerval.
- Eksportér til CSV.

#### Budgetter — Planlæg dit år

Opret et budget for hvert regnskabsår og sammenligne med faktiske resultater:

- Angiv forventede beløb for hver konto fordelt over 12 måneder.
- Ét aktivt budget pr. regnskabsår.
- Faktiske beløb beregnes automatisk fra bogførte finansejournaleposter.
- Viser afvigelse (budget vs. faktisk) pr. måned og pr. kontotype.
- Dynamisk værktøj, der kan opdateres løbende.

### 📂 Rapportering & Analyse

#### Rapporter — Resultatopgørelse og Balance

Træk de formelle økonomiske rapporter, som din revisor og Skattestyrelsen har brug for:

- **Resultatopgørelse** — Bruttofortjeneste, driftsresultat og nettoresultat for en valgt periode. Svarer på: tjener virksomheden penge?
- **Balance** — Aktiver (hvad virksomheden ejer), passiver (hvad den skylder) og egenkapital (ejernes investeringer plus opsparet overskud). Bekræfter: aktiver = passiver + egenkapital.

#### Momsafregning — Beregn og rapportér moms

Beregn den moms, du skal betale til — eller kan få tilbage fra — Skattestyrelsen:

- Opdelt i **udgående moms** (S25, S12, S0, SEU) og **indgående moms** (K25, K12, K0, KEU, KUF).
- Automatisk beregning af nettomoms (udgående minus indgående).
- Filtrer efter datointerval tilpasset din momsaflægsperiode.

#### Aldersopdelte Rapporter — Følg op på ubetalte fakturaer

Overblik over tilgodehavender og forpligtelser opdelt efter alder:

- Fem aldersspande: 0–30, 31–60, 61–90, 91–120 og 120+ dage.
- Værktøj til likviditetsstyring — se hurtigt, hvor der skal følges op på betalinger.
- Støtter både fordrings- og gældsaldersopdeling.

#### Likviditetsanalyse — Pengestrømme ind og ud

Likviditetsopgørelse (Cash Flow) efter den indirekte metode:

- **Driftsaktivitet** — penge fra kerneforretningen (salg minus driftsomkostninger).
- **Investeringsaktivitet** — køb/salg af langfristede aktiver.
- **Finansieringsaktivitet** — lån, indskud og udbytte.
- Verifikation mod faktiske kasse-/banksaldoændringer.

### 📂 Compliance & Afslutning

#### Bankafstemning — Afstem bankkontoudtog

Et lovkrav ifølge Bogføringsloven — sikr at regnskab og bankkonto stemmer overens:

- Import bankkontoudtog med åbnings-/lukningsbalancer og transaktionslinier.
- **Automatisk matchning** — Systemet matcher banklinier mod finansejournaleposter (±0,01 DKK inden for ±3 dage).
- **Manuel matchning** — Tilknyt umatchede linier til eksisterende poster.
- **Forslag** — Systemet foreslår matchningskandidater (±7 dage, ±1 DKK).
- Spor status: Umatchet, Matchet, Manuelt afstemt.

#### Regnskabsperioder — Lås og lås op for perioder

Lås individuelle måneder for at forhindre utilsigtede ændringer:

- Åben periode — fri bogføring, redigering og annullering.
- Luk periode — ingen ændringer mulige. Låsning afvises, hvis der findes kladder.
- Kalendervisning af alle måneder i det valgte regnskabsår.
- Op- og ulåsning registreres i revisionssporet.

#### Årsafslutning — Afslut regnskabsåret

Guidet proces der samler resultatopgørelsen og overfører årets resultat:

- **Forhåndsvisning** — Oversigt over årets resultat og de konti, der skal afsluttes.
- **Automatisk lukkepostering** — Nulstiller alle indtægts- og udgiftskonti og posterer årets resultat på konto 3300 (Årets resultat).
- **Automatisk periodelåsning** — Låser alle 12 regnskabsperioder for det afsluttede år.
- Det anbefales at udføre i samarbejde med en revisor.

#### Eksport — SAF-T og OIOUBL/Peppol

Generér officielle filformater til danske myndigheder:

- **SAF-T** — Standard Audit File for Tax (Danish Financial Schema v1.0) med automatisk pre- og post-validering.
- **OIOUBL/Peppol** — E-fakturaer i UBL 2.1-format kompatibelt med Peppol BIS Billing 3.0-netværket. Inkluderer forhåndsvalidering mod 11 forretningsregel-kategorier.

### 📂 Vedligehold & Sikkerhed

#### Indstillinger — Firmaprofil og konfiguration

Administrer din virksomheds profil og systemindstillinger:

- Virksomhedsnavn, adresse, telefon, e-mail, CVR-nummer.
- Bankoplysninger (reg.nr., kontonr., IBAN).
- Fakturaindstillinger (præfiks, betalingsbetingelser).
- Virksomhedslogo til faktura-PDF.
- Fuld data-nulstilling (sletter alle transaktioner, fakturaer og finansejournaleposter).

#### Backup — Opret og gendan sikkerhedskopier

Fuld kontrol over sikkerhedskopiering med et firetrins opbevaringssystem:

| Type | Opbevaring | Dækning |
|---|---|---|
| Timebaseret | 24 backups | Seneste døgn |
| Dagsbaseret | 30 backups | Seneste måned |
| Ugebaseret | 52 backups | Hele året |
| Månedlig | 60 backups | 5 år (Bogføringslovens krav) |

- Opret når som helst manuelle backups (f.eks. inden større ændringer).
- Gendan fra hvilken som helst backup — systemet opretter automatisk en sikkerhedskopi før gendannelse.
- Alle backups verificeres med SHA-256-checksum.
- Download backup-fil til egen computer som ekstra sikkerhed.

#### Revisionsspor — Alt logges automatisk

Uforanderlig (immutable) log over alle handlinger i systemet:

- **13 handlingstyper**: Oprettelse, opdatering, annullering, login, logout, sletningsforsøg, backup m.fl.
- Før- og efterværdier for alle ændringer, så det altid kan ses, hvad en post oplyste tidligere.
- Filtrer efter handlingstype, enhedstype og datointerval.
- Kan aldrig slettes eller ændres — et krav i den danske Bogføringslov.

---

## Demo-tilstand

Applikationen inkluderer en fuldt udstyret **Demo-tilstand**, der lader dig udforske alle funktioner uden at indtaste rigtige data:

- **Aktivér Demo-tilstand** — Seeder realistisk eksempeldata:
  - Virksomhed: "AlphaAi Consulting ApS" (CVR 12345678)
  - 4 kontakter (2 kunder, 2 leverandører)
  - 20 transaktioner (10 salg + 10 køb, jan–apr 2026)
  - 6 fakturaer med tilknyttede kontakter
  - 14 balancerede dobbeltposteringer med momskoder
  - 4 perioder (jan–apr 2026)
  - Standard 35-konto dansk kontoplan

- **Afslut Demo-tilstand** — Sletter al demodata på tværs af alle tabeller og seeder en ren live-kontoplan.

- **Dataisolering** — Demo- og live-data er fuldt adskilt via `isDemo`-flaget på alle datamodeller. Hjælpefunktionen `getDemoFilter()` injicerer automatisk det korrekte filter i alle databaseforespørgsler.

---

## Arkitektur

Applikationen er en **single-page application** (SPA) serveret fra én rute (`/`). Klient-side navigation styres af React state (`currentView`) — der findes ingen Next.js filsystem-ruter udover `/` og `/api/*`.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Zustand   │  │ React   │  │ shadcn/ui        │   │
│  │ Stores    │  │ Query   │  │ Components       │   │
│  │ (auth,    │  │ (fetch) │  │ (Radix + TW4)    │   │
│  │ sidebar,  │  │         │  │                  │   │
│  │ language) │  │         │  │ Recharts/Chart.js│   │
│  └────┬─────┘  └────┬─────┘  └──────────────────┘   │
│       │              │                                │
├───────┼──────────────┼────────────────────────────────┤
│       │         REST API (/api/*)                     │
│  ┌────▼──────────────▼────────────────────────────┐   │
│  │  Next.js 16 API Routes (App Router)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ Session  │ │ Rate     │ │ Audit Logger  │  │   │
│  │  │ Auth     │ │ Limiter  │ │ (Uforanderlig)│  │   │
│  │  └────┬─────┘ └──────────┘ └───────────────┘  │   │
│  └──────┼────────────────────────────────────────┘   │
│         │                                            │
│  ┌──────▼────────────────────────────────────────┐   │
│  │  Prisma ORM (SQLite)                          │   │
│  │  16 modeller · 13 enums · Per-bruger isolation │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Teknologisk Stack

| Lag | Teknologi | Version | Formål |
|---|---|---|---|
| **Runtime** | [Bun](https://bun.sh/) | 1.3+ | JavaScript runtime, pakkehåndtering, scriptkører |
| **Framework** | [Next.js](https://nextjs.org/) | 16.1 | React SSR/SSG framework (App Router) |
| **UI-bibliotek** | [React](https://react.dev/) | 19 | Komponent-framework |
| **Sprog** | [TypeScript](https://www.typescriptlang.org/) | 5 | Statisk typekontrol |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | 4 | Utility-first CSS |
| **Komponenter** | [shadcn/ui](https://ui.shadcn.com/) | new-york | 35+ Radix UI-baserede komponenter |
| **Ikoner** | [Lucide React](https://lucide.dev/) | — | 40+ ikoner |
| **State** | [Zustand](https://zustand.docs.pmnd.rs/) | 5 | Klient-side state (auth, sidebar, sprog) |
| **Server State** | [TanStack React Query](https://tanstack.com/query) | 5 | Server state caching & synkronisering |
| **Formularer** | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | 7 / 4 | Formhåndtering & validering |
| **Database** | [SQLite](https://sqlite.org/) via [Prisma](https://www.prisma.io/) | 6.11 | Filbaseret relationel database |
| **Diagrammer** | [Recharts](https://recharts.org/) + [Chart.js](https://www.chartjs.org/) | 2 / 4 | Datavisualisering |
| **PDF** | [pdf-lib](https://pdf-lib.js.org/) | 1.17 | Server-side faktura PDF-generering |
| **OCR** | [Tesseract.js](https://tesseract.projectnaptha.com/) | 7 | Klient-side kvitteringsscanning |
| **XML** | [xmlbuilder2](https://github.com/oozcitak/xmlbuilder2) | 4 | SAF-T og OIOUBL XML-generering |
| **Animationer** | [Framer Motion](https://www.framer.com/motion/) | 12 | UI-overgange |
| **Sprog** | [next-intl](https://next-intl.dev/) | 4 | Internationaliseringsframework |
| **Mørk tilstand** | [next-themes](https://github.com/pacocoursey/next-themes) | 0.4 | Temastyring |
| **DnD** | [@dnd-kit](https://dndkit.com/) | 6 | Træk og slip |
| **Datoer** | [date-fns](https://date-fns.org/) + [react-day-picker](https://daypicker.dev/) | 4 / 9 | Datoværktøjer & vælgere |
| **Processtyring** | [PM2](https://pm2.keymetrics.io/) | — | Produktionsprocesstyring |
| **Reverse Proxy** | [Caddy](https://caddyserver.com/) | — | HTTPS-terminering & routing |

### Databaseskema

SQLite-databasen indeholder **16 modeller** og **13 enums**:

**Kernemodeller:** `User`, `Session`, `CompanyInfo`, `Account`, `Transaction`, `JournalEntry`, `JournalEntryLine`, `Invoice`, `Contact`

**Compliance- & Rapporteringsmodeller:** `FiscalPeriod`, `BankStatement` / `BankStatementLine`, `AuditLog`, `Backup`, `Document`, `RecurringEntry`, `Budget` / `BudgetEntry`

**Vigtige Enums:** `TransactionType` (7), `InvoiceStatus` (4), `AccountType` (5), `AccountGroup` (18), `JournalEntryStatus` (3), `ContactType` (3), `PeriodStatus` (2), `VATCode` (10), `RecurringFrequency` (5), `RecurringStatus` (3), `ReconciliationStatus` (3).

### API-Oversigt

Applikationen eksponerer **46 REST API-endpoints** under `/api/`. Alle muterende endpoints kræver sessionsbaseret godkendelse og genererer revisionslog-poster.

| Kategori | Endpoints | Nøgleoperationer |
|---|---|---|
| **Godkendelse** | `auth/login`, `auth/register`, `auth/me`, `auth/logout`, `auth/delete-account` | Sessionshåndtering, rate-limited login/register |
| **Konti** | `accounts`, `accounts/[id]`, `accounts/seed` | CRUD + seeding af standard dansk kontoplan |
| **Transaktioner** | `transactions`, `transactions/export`, `transactions/export-peppol` | CRUD + CSV-eksport + OIOUBL-eksport |
| **Finansejournal** | `journal-entries`, `journal-entries/[id]` | Dobbeltposterings CRUD med balancevalidering |
| **Fakturaer** | `invoices`, `invoices/[id]`, `invoices/[id]/pdf`, `invoices/[id]/oioubl`, `invoices/[id]/oioubl/validate` | Fakturalivscyklus + PDF + Peppol |
| **Kontakter** | `contacts`, `contacts/[id]` | Kunde/leverandør adressebog |
| **Rapporter** | `reports`, `ledger`, `vat-register`, `cash-flow`, `aging-reports` | Økonomisk rapporteringssuite |
| **Bankafstemning** | `bank-reconciliation` | Kontoudtog-import, auto-match, manuel match |
| **Perioder** | `fiscal-periods`, `fiscal-periods/[id]` | Årlige perioder, lås/lås op måneder |
| **Budgetter** | `budgets` | Årlig budget CRUD med faktisk-vs-budget sammenligning |
| **Gentagende** | `recurring-entries`, `recurring-entries/execute` | Skabelonhåndtering og et-klik eksekvering |
| **Årsafslutning** | `year-end-closing` | Forhåndsvisning og eksekvering med auto periodelåsning |
| **Eksporter** | `export-saft` | Dansk SAF-T Financial XML |
| **Backups** | `backups`, `backups/[id]`, `backups/download/[id]` | Opret, gendan, download backups |
| **Dokumenter** | `documents`, `documents/[id]`, `documents/serve/[...path]` | Upload, server, slet med path traversal-beskyttelse |
| **Revision** | `audit-logs` | Pagineret, filtrerbar revisionslog |
| **Virksomhed** | `company` | Virksomhedsoplysninger CRUD + fuld data-nulstilling |
| **Bruger** | `user/preferences` | Sidebar-præferencer synkronisering |
| **Demo** | `demo-mode`, `demo-seed` | Demo-tilstand toggle og data-seeding |

---

## Installation & Opsætning

### Tilgængelige Scripts

| Kommando | Beskrivelse |
|---|---|
| `bun run dev` | Start udviklingsserver (port 3000, Webpack-tilstand) |
| `bun run dev:direct` | Start dev-server uden porttjek |
| `bun run build` | Opret optimeret produktionsbuild |
| `bun run start` | Start produktionsserver (efter `build`) |
| `bun run start:pm2` | Start via PM2 processtyring (VPS) |
| `bun run lint` | Kør ESLint |
| `bun run db:push` | Synkroniser Prisma-skema til database |
| `bun run db:generate` | Regenerer Prisma Client-typer |
| `bun run db:reset` | Nulstil databasen fuldstændigt (**sletter alle data**) |
| `bun run kill-port [port]` | Dræb proces på en port (standard: 3000) |
| `bun run ports` | Scan porttilgængelighed for 3000–3009 |

### Produktions-Deployment

Til cloud VPS med **Caddy** (auto-HTTPS) og **PM2** (processtyring):

```bash
bun run build
bun run db:push
bun run start:pm2
# Konfigurer Caddy (se Caddyfile)
sudo caddy reload --config /sti/til/Caddyfile
```

Se [`STARTUP.md`](./STARTUP.md) for detaljerede deploymentsinstruktioner.

---

## Projektstruktur

```
AlphaAi-Accounting/
├── prisma/
│   ├── schema.prisma              # 16 modeller, 13 enums (SQLite)
│   └── db/custom.db               # Databasefil (auto-oprettet)
├── public/
│   ├── logo.svg / logo.png       # Brand-logo
│   ├── logo-white.png             # Hvid variant
│   ├── logo-clean.png             # Login/dashboard variant
│   ├── manifest.json              # PWA-manifest (dansk, standalone)
│   ├── sw.js                      # Service worker (3-lags caching)
│   └── robots.txt                 # Crawler-politik
├── scripts/
│   ├── dev-server.ts              # Smart dev-starter (porttjek + Webpack)
│   └── kill-port.ts               # Tværplatform port-dræber
├── src/
│   ├── app/
│   │   ├── page.tsx               # Rod SPA-side (auth + visningsrouter)
│   │   ├── layout.tsx             # Rod-layout (skrifttyper, PWA, toaster)
│   │   ├── globals.css            # Tema, komponentstile, mørk tilstand
│   │   └── api/                   # 46 API route-handlers
│   │       ├── auth/              # Login, register, me, logout, slet-konto
│   │       ├── accounts/          # CRUD + seed
│   │       ├── transactions/      # CRUD + CSV/Peppol-eksport
│   │       ├── journal-entries/   # Dobbeltposterings CRUD
│   │       ├── invoices/          # CRUD + PDF + OIOUBL + validering
│   │       ├── contacts/          # Kunde/leverandør CRUD
│   │       ├── reports/           # Resultatopgørelse + balance
│   │       ├── ledger/            # Hovedbog + statusopgørelse
│   │       ├── bank-reconciliation/ # Import + auto-match + manuel match
│   │       ├── cash-flow/         # Likviditetsopgørelse
│   │       ├── vat-register/      # Dansk momsrapport
│   │       ├── export-saft/       # SAF-T XML
│   │       ├── fiscal-periods/    # Periodehåndtering + låsning
│   │       ├── budgets/           # Budgetter med afvigelse
│   │       ├── recurring-entries/ # Gentagende posteringer
│   │       ├── year-end-closing/  # Årsafslutning
│   │       ├── aging-reports/     # Aldersopdeling
│   │       ├── backups/           # Backup-styring
│   │       ├── audit-logs/        # Revisionsspor
│   │       ├── documents/         # Dokumenthåndtering
│   │       ├── company/           # Virksomhedsoplysninger
│   │       ├── demo-mode/         # Demo-tilstand
│   │       └── demo-seed/         # Demo-seeding
│   ├── components/
│   │   ├── auth/                  # Login- og registreringsformularer
│   │   ├── dashboard/             # Dashboard med nøgletal og diagrammer
│   │   ├── layout/                # AppLayout (sidebar, mørk tilstand, mobil)
│   │   ├── transactions/          # Transaktionsliste og formular
│   │   ├── invoices/              # Fakturastyring
│   │   ├── chart-of-accounts/     # Kontoplan
│   │   ├── journal/               # Finansejournal
│   │   ├── contacts/              # Kontakter
│   │   ├── ledger/                # Hovedbog
│   │   ├── reports/               # Rapporter
│   │   ├── vat-report/            # Momsregister
│   │   ├── bank-reconciliation/   # Bankafstemning
│   │   ├── cash-flow/             # Likviditet
│   │   ├── aging-reports/         # Aldersopdeling
│   │   ├── exports/               # Eksport
│   │   ├── fiscal-periods/        # Perioder
│   │   ├── budget/                # Budgetter
│   │   ├── recurring-entries/     # Gentagende posteringer
│   │   ├── year-end-closing/      # Årsafslutning
│   │   ├── backup/                # Backup
│   │   ├── audit-log/             # Revisionsspor
│   │   ├── settings/              # Indstillinger
│   │   ├── pwa/                   # PWA-registrering + offline-besked
│   │   └── ui/                    # 35+ shadcn/ui komponenter
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── session.ts             # Kryptografisk sessionshåndtering
│   │   ├── password.ts            # bcrypt hashing
│   │   ├── rate-limit.ts          # Rate limiter
│   │   ├── audit.ts               # Uforanderlig revisionslog
│   │   ├── auth-store.ts          # Zustand auth-state
│   │   ├── sidebar-store.ts       # Sidebar-præferencer
│   │   ├── language-store.ts      # Sprogpræference (DA/EN)
│   │   ├── translations.ts        # 130+ oversættelser
│   │   ├── currency-utils.ts      # Flervaluta formatering
│   │   ├── seed-chart-of-accounts.ts # 35-konto FSR seeder
│   │   ├── oioubl-generator.ts    # Peppol XML-generator
│   │   ├── oioubl-validator.ts    # OIOUBL-validator
│   │   ├── saft-validator.ts      # SAF-T-validator
│   │   ├── pdf-generator.ts       # A4 faktura PDF
│   │   ├── backup-engine.ts       # Backup/gendan med SHA-256
│   │   └── ocr-utils.ts           # Tesseract.js kvitteringsscanner
│   └── hooks/                     # React hooks
├── Caddyfile                      # Reverse proxy (dev + prod)
├── ecosystem.config.js            # PM2 konfig
├── package.json                   # Afhængigheder og scripts
├── tailwind.config.ts             # Tailwind tema
├── tsconfig.json                  # TypeScript konfig
├── components.json                # shadcn/ui konfig
└── STARTUP.md                     # Deploymentsvejledning
```

---

## Regulatorisk Compliance

| Regulering | Implementering |
|---|---|
| **Bogføringsloven §4–8** (Registrering) | Uforanderlig revisionslog, soft-delete annullering, ingen hard-sletning |
| **Bogføringsloven §10–12** (Revisionslog) | Alle mutationer logges med bruger, tidsstempel, IP, user-agent og feltniveau-ændringer |
| **Bogføringsloven §15** (Opbevaring) | Backup-system med SHA-256 verifikation, 5-års opbevaringspolitik |
| **Danske momskoder** | 10 koder: S25, S12, S0, SEU (udgående) og K25, K12, K0, KEU, KUF (indgående) + NONE |
| **FSR Kontoplan** | 35 standardkonti fordelt på 18 kontogrupper |
| **SAF-T Danmark** | Danish Financial Schema v1.0 XML med pre- og post-validering |
| **OIOUBL / Peppol** | Peppol BIS Billing 3.0 (UBL 2.1) med 11-kategori validering |
| **Årsafslutning** | Automatisk nulstilling af resultatkonti med posting til konto 3300 |

---

## Tips og God Praksis

- **Bogfør løbende** — Sæt 15–30 minutter af om ugen. Et løbende bogført regnskab giver altid et aktuelt overblik og gør årsafslutningen lettere.
- **Gem alle bilag** — Brug OCR-modulet til at scanne kvitteringer digitalt. Ifølge Bogføringsloven skal bilag opbevares i mindst 5 år.
- **Brug kontoplanen konsekvent** — Vælg altid den rigtige konto. En konsekvent brug sikrer meningsfulde rapporter.
- **Afstem bankkontoen månedligt** — Bankafstemning er både et lovkrav og det mest effektive redskab til at opdage fejl.
- **Lav en backup inden større ændringer** — Opret en manuel backup inden årsafslutning, sletning af store posteringer eller dataimport.
- **Lås perioder løbende** — Lås hver måned, når bankafstemningen er udført og alle posteringer er korrekte.

---

## Ofte Stillede Spørgsmål

**Kan jeg bruge systemet uden kendskab til bogholderi?**
Ja, systemet er designet til at være brugervenligt. Standardkontoplanen kan oprettes med ét klik, og de fleste moduler er intuitive. Dog kræver dobbelt bogføring — som er kernefunktionen — en grundlæggende forståelse af debet og kredit. Systemet hjælper med at validere balance, men det anbefales at sætte sig ind i principperne eller konsultere en revisor.

**Kan jeg skifte sprog undervejs?**
Ja, skift mellem dansk og engelsk når som helst via sprogknappen i sidemenuen. Valget gemmes automatisk. Kontonavnene findes på både dansk og engelsk.

**Hvor gemmes mine data?**
Dine data gemmes i en SQLite-database på den server, hvor applikationen er installeret. Systemet opretter automatisk backups. Hvis du selv administrerer serveren, bør backup-filer opbevares sikkert — helst på en separat lokation.

**Hvad er SAF-T, og har jeg brug for det?**
SAF-T (Standard Audit File for Tax) er et format, som Skattestyrelsen kan bede om. Filen indeholder alle dine regnskabsdata struktureret i XML. Om din virksomhed er omfattet af kravet, afhænger af størrelse og type — spørg din revisor.

**Kan jeg eksportere til andre formater?**
Ja — CSV (Excel/Google Sheets), SAF-T XML (Skattestyrelsen) og OIOUBL/Peppol (elektroniske fakturaer).

**Hvad sker der, hvis jeg sletter en postering ved en fejl?**
Posteringer slettes aldrig permanent. De markeres som "Annulleret" med årsag, forbliver i systemet og kan ses i revisionssporet — men indgår ikke i rapporter og beregninger.

**Kan flere personer bruge systemet samtidigt?**
Hver bruger har sin egen fuldt isolerede konto med eget regnskab. Der er pt. ikke mulighed for at flere personer at arbejde i det samme regnskab.

**Skal jeg bruge en revisor?**
Systemet giver værktøjerne til at føre dit eget regnskab. Enkeltpersonsvirksomheder med enkle forhold kan ofte klare sig selv. Virksomheder med ansatte, varelager eller udenlandske transaktioner har typisk gavn af professionel rådgivning.

---

## Fejlfinding

### Port 3000 er allerede i brug
```bash
bun run kill-port
```

### Databasefejl efter skemaændringer
```bash
bun run db:push
bun run db:generate
```

### Ren geninstallation
```bash
rm -rf .next node_modules prisma/db/custom.db
bun install
bun run db:push
bun run dev
```

### Turbopack + Prisma fejl
Udviklingsserveren bruger Webpack-tilstand (Turbopack har modulopløsningsproblemer med Prisma i Next.js 16):
```bash
bun run dev  # Bruger automatisk --webpack
```

### Manglende moduler efter opdateringer
```bash
bun install
bun run db:push
bun run db:generate
```

---

## Licens

Privat repository. Alle rettigheder forbeholdes.
