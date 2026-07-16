import type { AppLocale } from "@/i18n/routing";

/**
 * Legal / trust page content.
 *
 * <!-- LEGAL REVIEW NEEDED -->
 * These are honest, good-faith DRAFTS written to reflect what the product
 * actually does — they are NOT reviewed legal text. A qualified lawyer must
 * review all three documents before launch, and the imprint placeholders
 * ([bracketed]) must be filled with the real operating entity's details.
 * The facts stated about data (what is stored, which processors, retention)
 * are accurate as of this sprint; keep them in sync if the data model changes.
 */

export type LegalKind = "privacy" | "terms" | "imprint";
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; updated: string; sections: LegalSection[] };

const UPDATED = "2026-07-16";

export const LEGAL: Record<LegalKind, Record<AppLocale, LegalDoc>> = {
  privacy: {
    en: {
      title: "Privacy Policy",
      updated: UPDATED,
      sections: [
        {
          heading: "What we store",
          body: [
            "We deliberately collect as little as possible. For your account we store your email address. For each child you add, we store only a nickname and a birth month — never a full name, photo, or date of birth. We store the feedback you give after a session (whether an activity was completed, how it went, and enjoyment) and the worksheet recipes generated for your children.",
            "Worksheets themselves are never stored as files — only the recipe (which generator, which seed) needed to reproduce them.",
          ],
        },
        {
          heading: "Why we store it",
          body: [
            "The child nickname and birth month let us tailor worksheets to an age and address the child by name on the page. Feedback drives the adaptive difficulty so activities stay winnable. Your email is used to sign you in and to send essential account email. We do not sell data, and we do not use it for advertising.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use only the essential cookies required to keep you signed in. We do not use tracking, analytics, or advertising cookies, so there is no consent banner to click through — there is nothing non-essential to consent to.",
          ],
        },
        {
          heading: "Who processes it",
          body: [
            "We use a small number of processors to run the service: Supabase (database, authentication, hosting) stores your account and child data; Stripe processes subscription payments (we never see your card details); Resend delivers email. Each acts only on our instructions.",
          ],
        },
        {
          heading: "Retention and deletion",
          body: [
            "We keep your data while your account is active. You can delete your account at any time from Settings — this permanently and immediately removes your account, every child profile, and all associated sessions, worksheets, and feedback. Deletion cascades through our database and cannot be undone.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Under the GDPR you may access, correct, export, or erase your data, and object to or restrict processing. Account deletion in Settings covers erasure directly; for anything else, contact us at [contact email]. You may also complain to your local data protection authority.",
          ],
        },
        {
          heading: "Children's data",
          body: [
            "This service is operated by and for parents and educators. Children do not have accounts and we never contact a child directly. Because we store only a nickname and birth month, a child is not identifiable from our records alone. You control all of it and can remove it at any time.",
          ],
        },
      ],
    },
    hu: {
      title: "Adatvédelmi tájékoztató",
      updated: UPDATED,
      sections: [
        {
          heading: "Milyen adatot tárolunk",
          body: [
            "Szándékosan a lehető legkevesebbet gyűjtjük. A fiókodhoz az e-mail-címedet tároljuk. Minden gyerekhez csak egy becenevet és egy születési hónapot — soha nem teljes nevet, fényképet vagy pontos születési dátumot. Tároljuk a foglalkozás utáni visszajelzéseidet (elkészült-e a feladat, hogyan ment, mennyire élvezte), és a gyerekeidnek generált feladatlap-recepteket.",
            "Magukat a feladatlapokat sosem tároljuk fájlként — csak a receptet (melyik generátor, melyik seed), amiből újra előállíthatók.",
          ],
        },
        {
          heading: "Miért tároljuk",
          body: [
            "A gyerek beceneve és születési hónapja alapján tudjuk életkorra szabni a feladatlapokat, és néven szólítani a gyereket a lapon. A visszajelzés vezérli az adaptív nehézséget, hogy a feladatok teljesíthetők maradjanak. Az e-mail-címed a belépéshez és a fontos fiók-értesítésekhez kell. Adatot nem adunk el, és hirdetéshez nem használunk.",
          ],
        },
        {
          heading: "Sütik",
          body: [
            "Csak a bejelentkezés fenntartásához szükséges alapvető sütiket használjuk. Nincs nyomkövető, analitikai vagy hirdetési süti, ezért nincs elfogadó sáv sem — nincs mihez hozzájárulnod.",
          ],
        },
        {
          heading: "Ki dolgozza fel",
          body: [
            "A szolgáltatás működtetéséhez néhány adatfeldolgozót veszünk igénybe: a Supabase (adatbázis, hitelesítés, tárhely) tárolja a fiók- és gyerekadatokat; a Stripe kezeli az előfizetés fizetését (a kártyaadataidat mi sosem látjuk); a Resend kézbesíti az e-maileket. Mindegyik kizárólag a mi utasításunkra jár el.",
          ],
        },
        {
          heading: "Megőrzés és törlés",
          body: [
            "Az adataidat a fiókod fennállásáig őrizzük. A fiókodat bármikor törölheted a Beállításokban — ez azonnal és véglegesen eltávolítja a fiókot, minden gyerekprofilt, és az összes kapcsolódó foglalkozást, feladatlapot és visszajelzést. A törlés végigfut az adatbázison, és nem vonható vissza.",
          ],
        },
        {
          heading: "A jogaid",
          body: [
            "A GDPR szerint hozzáférhetsz, helyesbíthetsz, exportálhatsz vagy töröltethetsz adatokat, és tiltakozhatsz a kezelés ellen vagy korlátozhatod azt. A törlést a Beállításokban közvetlenül elvégezheted; bármi máshoz írj a [kapcsolati e-mail] címre. Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz is fordulhatsz.",
          ],
        },
        {
          heading: "Gyerekek adatai",
          body: [
            "A szolgáltatást szülők és pedagógusok működtetik és használják. A gyerekeknek nincs fiókjuk, és a gyerekkel közvetlenül soha nem lépünk kapcsolatba. Mivel csak becenevet és születési hónapot tárolunk, a gyerek önmagában a nyilvántartásunkból nem azonosítható. Minden adat feletti rendelkezés a tiéd, bármikor eltávolíthatod.",
          ],
        },
      ],
    },
    de: {
      title: "Datenschutzerklärung",
      updated: UPDATED,
      sections: [
        {
          heading: "Welche Daten wir speichern",
          body: [
            "Wir erheben bewusst so wenig wie möglich. Für dein Konto speichern wir deine E-Mail-Adresse. Für jedes Kind speichern wir nur einen Spitznamen und einen Geburtsmonat — niemals einen vollständigen Namen, ein Foto oder ein genaues Geburtsdatum. Wir speichern dein Feedback nach einer Einheit (ob eine Aufgabe erledigt wurde, wie es lief, wie viel Freude sie gemacht hat) sowie die für deine Kinder erzeugten Arbeitsblatt-Rezepte.",
            "Die Arbeitsblätter selbst werden nie als Datei gespeichert — nur das Rezept (welcher Generator, welcher Seed), um sie zu reproduzieren.",
          ],
        },
        {
          heading: "Warum wir sie speichern",
          body: [
            "Spitzname und Geburtsmonat erlauben es, Arbeitsblätter altersgerecht zu gestalten und das Kind auf dem Blatt beim Namen zu nennen. Feedback steuert die adaptive Schwierigkeit, damit Aufgaben machbar bleiben. Deine E-Mail dient der Anmeldung und wichtigen Konto-E-Mails. Wir verkaufen keine Daten und nutzen sie nicht für Werbung.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "Wir verwenden nur die notwendigen Cookies, um dich angemeldet zu halten. Keine Tracking-, Analyse- oder Werbe-Cookies — daher kein Zustimmungsbanner, denn es gibt nichts Nicht-Notwendiges zuzustimmen.",
          ],
        },
        {
          heading: "Wer sie verarbeitet",
          body: [
            "Zum Betrieb nutzen wir wenige Auftragsverarbeiter: Supabase (Datenbank, Authentifizierung, Hosting) speichert Konto- und Kinderdaten; Stripe verarbeitet Abo-Zahlungen (deine Kartendaten sehen wir nie); Resend stellt E-Mails zu. Jeder handelt nur nach unseren Weisungen.",
          ],
        },
        {
          heading: "Aufbewahrung und Löschung",
          body: [
            "Wir speichern deine Daten, solange dein Konto besteht. Du kannst dein Konto jederzeit in den Einstellungen löschen — das entfernt sofort und dauerhaft das Konto, jedes Kinderprofil und alle zugehörigen Einheiten, Arbeitsblätter und Feedbacks. Die Löschung greift durch die gesamte Datenbank und ist unwiderruflich.",
          ],
        },
        {
          heading: "Deine Rechte",
          body: [
            "Nach der DSGVO kannst du Daten einsehen, berichtigen, exportieren oder löschen und der Verarbeitung widersprechen oder sie einschränken. Die Löschung erledigst du direkt in den Einstellungen; für alles andere schreib an [Kontakt-E-Mail]. Du kannst dich auch bei deiner Datenschutzaufsichtsbehörde beschweren.",
          ],
        },
        {
          heading: "Daten von Kindern",
          body: [
            "Der Dienst wird von und für Eltern und Pädagogen betrieben. Kinder haben keine Konten, und wir kontaktieren ein Kind nie direkt. Da wir nur Spitzname und Geburtsmonat speichern, ist ein Kind allein aus unseren Daten nicht identifizierbar. Du verfügst über alles und kannst es jederzeit entfernen.",
          ],
        },
      ],
    },
  },

  terms: {
    en: {
      title: "Terms of Service",
      updated: UPDATED,
      sections: [
        {
          heading: "The service",
          body: [
            "BrainForge Kids generates printable developmental worksheets and screen-free activity plans for children. It is an educational tool for play and practice. It is not medical, psychological, or therapeutic advice, and it is not a substitute for professional assessment.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "You are responsible for keeping access to your account secure and for the activity under it. Accounts are for you and the children in your care, not for resale.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Use the generated worksheets and plans for personal, family, or classroom use. Please don't attempt to disrupt the service, abuse the generation limits, or redistribute the service itself as your own.",
          ],
        },
        {
          heading: "Subscriptions and billing",
          body: [
            "The free plan includes a limited number of worksheets per week. Paid plans (Premium, Family) are billed monthly through Stripe and renew until cancelled. You can cancel anytime from the customer portal; access continues to the end of the paid period.",
            "<!-- LEGAL REVIEW NEEDED --> Refund policy (e.g. statutory withdrawal rights for EU consumers) must be specified here by counsel.",
          ],
        },
        {
          heading: "Availability and disclaimer",
          body: [
            "The service is provided \"as is\", without warranty of any kind. We work to keep it available and correct, but we do not guarantee uninterrupted or error-free operation.",
          ],
        },
        {
          heading: "Limitation of liability",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> To the extent permitted by law, our liability is limited. The precise limitation and any mandatory consumer protections must be set by counsel for the operating jurisdiction.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "We may update these terms; we'll update the date above and, for material changes, notify you. Continued use after a change means you accept it.",
          ],
        },
      ],
    },
    hu: {
      title: "Felhasználási feltételek",
      updated: UPDATED,
      sections: [
        {
          heading: "A szolgáltatás",
          body: [
            "A BrainForge Kids nyomtatható fejlesztő feladatlapokat és képernyőmentes foglalkozásterveket készít gyerekeknek. Ez játékos, gyakorláshoz készült oktatási eszköz. Nem orvosi, pszichológiai vagy terápiás tanács, és nem helyettesíti a szakértői vizsgálatot.",
          ],
        },
        {
          heading: "A fiókod",
          body: [
            "Te felelsz a fiókodhoz való hozzáférés biztonságáért és a fiók alatti tevékenységért. A fiók a te és a gondozásodban lévő gyerekek használatára szolgál, nem továbbértékesítésre.",
          ],
        },
        {
          heading: "Elfogadható használat",
          body: [
            "A generált feladatlapokat és terveket személyes, családi vagy osztálytermi célra használd. Kérjük, ne próbáld megzavarni a szolgáltatást, ne élj vissza a generálási kerettel, és ne értékesítsd tovább magát a szolgáltatást sajátodként.",
          ],
        },
        {
          heading: "Előfizetés és számlázás",
          body: [
            "Az ingyenes csomag hetente korlátozott számú feladatlapot tartalmaz. A fizetős csomagokat (Premium, Family) a Stripe havonta számlázza, és lemondásig megújulnak. Az ügyfélportálon bármikor lemondhatod; a hozzáférés a kifizetett időszak végéig megmarad.",
            "<!-- LEGAL REVIEW NEEDED --> A visszatérítési szabályzatot (pl. az EU-fogyasztók elállási joga) ügyvédnek kell itt megadnia.",
          ],
        },
        {
          heading: "Elérhetőség és felelősségkizárás",
          body: [
            "A szolgáltatást „ahogy van” alapon nyújtjuk, mindenféle szavatosság nélkül. Igyekszünk elérhetővé és hibátlanná tenni, de nem garantáljuk a folyamatos vagy hibamentes működést.",
          ],
        },
        {
          heading: "A felelősség korlátozása",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> A jog által megengedett mértékig a felelősségünk korlátozott. A pontos korlátozást és a kötelező fogyasztóvédelmi rendelkezéseket az adott joghatóságra ügyvédnek kell meghatároznia.",
          ],
        },
        {
          heading: "Változások",
          body: [
            "A feltételeket módosíthatjuk; a fenti dátumot frissítjük, lényeges változás esetén értesítünk. A módosítás utáni további használat annak elfogadását jelenti.",
          ],
        },
      ],
    },
    de: {
      title: "Nutzungsbedingungen",
      updated: UPDATED,
      sections: [
        {
          heading: "Der Dienst",
          body: [
            "BrainForge Kids erstellt druckbare Förder-Arbeitsblätter und bildschirmfreie Aktivitätspläne für Kinder. Es ist ein pädagogisches Werkzeug zum Spielen und Üben. Es ist keine medizinische, psychologische oder therapeutische Beratung und ersetzt keine fachliche Beurteilung.",
          ],
        },
        {
          heading: "Dein Konto",
          body: [
            "Du bist für die sichere Zugangsverwaltung deines Kontos und die Aktivität darunter verantwortlich. Konten sind für dich und die Kinder in deiner Obhut bestimmt, nicht zum Weiterverkauf.",
          ],
        },
        {
          heading: "Zulässige Nutzung",
          body: [
            "Nutze die erzeugten Arbeitsblätter und Pläne für den privaten, familiären oder schulischen Gebrauch. Bitte versuche nicht, den Dienst zu stören, die Generierungslimits zu missbrauchen oder den Dienst selbst als deinen eigenen weiterzuverbreiten.",
          ],
        },
        {
          heading: "Abonnements und Abrechnung",
          body: [
            "Der kostenlose Plan enthält eine begrenzte Zahl an Arbeitsblättern pro Woche. Bezahlpläne (Premium, Family) werden monatlich über Stripe abgerechnet und verlängern sich bis zur Kündigung. Du kannst jederzeit im Kundenportal kündigen; der Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen.",
            "<!-- LEGAL REVIEW NEEDED --> Die Widerrufs-/Erstattungsregelung (z. B. gesetzliches Widerrufsrecht für EU-Verbraucher) ist hier durch einen Anwalt festzulegen.",
          ],
        },
        {
          heading: "Verfügbarkeit und Haftungsausschluss",
          body: [
            "Der Dienst wird „wie besehen“ ohne jegliche Gewährleistung bereitgestellt. Wir bemühen uns um Verfügbarkeit und Richtigkeit, garantieren aber keinen ununterbrochenen oder fehlerfreien Betrieb.",
          ],
        },
        {
          heading: "Haftungsbeschränkung",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> Soweit gesetzlich zulässig, ist unsere Haftung beschränkt. Die genaue Beschränkung und zwingende Verbraucherschutzrechte sind durch einen Anwalt für die Betriebsjurisdiktion festzulegen.",
          ],
        },
        {
          heading: "Änderungen",
          body: [
            "Wir können diese Bedingungen aktualisieren; wir passen das obige Datum an und informieren bei wesentlichen Änderungen. Die weitere Nutzung nach einer Änderung gilt als Zustimmung.",
          ],
        },
      ],
    },
  },

  imprint: {
    en: {
      title: "Imprint",
      updated: UPDATED,
      sections: [
        {
          heading: "Service operator",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Operator legal name], [registered address]. Replace with the real operating entity before launch.",
          ],
        },
        {
          heading: "Contact",
          body: ["Email: [contact email]"],
        },
        {
          heading: "Registration",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Company registration number / VAT ID, if applicable]. Some jurisdictions (e.g. Germany's §5 TMG) mandate specific imprint fields — confirm with counsel.",
          ],
        },
        {
          heading: "Responsible for content",
          body: ["<!-- LEGAL REVIEW NEEDED --> [Name of the person responsible]."],
        },
      ],
    },
    hu: {
      title: "Impresszum",
      updated: UPDATED,
      sections: [
        {
          heading: "A szolgáltatás üzemeltetője",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Üzemeltető hivatalos neve], [székhely]. Indulás előtt cseréld a valós üzemeltető adataira.",
          ],
        },
        {
          heading: "Kapcsolat",
          body: ["E-mail: [kapcsolati e-mail]"],
        },
        {
          heading: "Nyilvántartás",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Cégjegyzékszám / adószám, ha van]. Egyes joghatóságok kötelező impresszum-mezőket írnak elő — egyeztesd ügyvéddel.",
          ],
        },
        {
          heading: "A tartalomért felelős",
          body: ["<!-- LEGAL REVIEW NEEDED --> [A felelős személy neve]."],
        },
      ],
    },
    de: {
      title: "Impressum",
      updated: UPDATED,
      sections: [
        {
          heading: "Betreiber des Dienstes",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Rechtlicher Name des Betreibers], [eingetragene Anschrift]. Vor dem Start durch die reale Betreibergesellschaft ersetzen.",
          ],
        },
        {
          heading: "Kontakt",
          body: ["E-Mail: [Kontakt-E-Mail]"],
        },
        {
          heading: "Registrierung",
          body: [
            "<!-- LEGAL REVIEW NEEDED --> [Handelsregisternummer / USt-IdNr., falls zutreffend]. §5 TMG schreibt in Deutschland bestimmte Impressumsangaben vor — mit Anwalt bestätigen.",
          ],
        },
        {
          heading: "Verantwortlich für den Inhalt",
          body: ["<!-- LEGAL REVIEW NEEDED --> [Name der verantwortlichen Person]."],
        },
      ],
    },
  },
};
