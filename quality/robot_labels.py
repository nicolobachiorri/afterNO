"""
Which buttons the measurement robot clicks as "reject" (3 November 2026).

The robot of step 1 knew Italian and English only. The extension knows the main
formulas of eight EU languages (extension/lib/choice.ts, REJECT): the robot gets the
same words here, so that a site in German or French is measurable. Keep the two
lists in step; a change to one is a change to the other.

measure.py and diagnose.py install these patterns in divergence_test before using its
banner functions, so step 1's own file (and its results) stay as they were.
"""

import re

# A label that also talks about changing or managing opens the settings (see
# SETTINGS in choice.ts): never clicked as a rejection.
SETTINGS = (r"ändern|einstellungen|anpassen|verwalten|\bmanage|settings|customi[sz]e|preferences|gestisci|"
            r"personalizza|impostazioni|modifica|param[eé]tr|personnalis|g[eé]rer|configur|gestionar|personaliz|"
            r"gerir|aanpassen|instellen|instellingen|beheren|zarz[aą]dzaj|ustawieni|dostosuj")

REJECT_PATTERN = re.compile(
    # tarteaucitron names its buttons "Cookies : Deny all cookies" (idonate.ie, sample F):
    # the accessible name, which the robot matches, starts with "Cookies :".
    r"^(?!.*(" + SETTINGS + r"))\s*(cookies?\s*:\s*)?("
    # Italian
    r"rifiut|nega(re)?\b|nega il|non accett|non acconsent|(continua|prosegui) senza accettare|no,? grazie|"
    r"(accetta |consenti |usa |continua con )?solo (i |gli |le )?(cookie )?(strettamente )?(necessari|essenziali|tecnici)|"
    # English
    r"(i )?(reject|decline|deny|disagree|refuse|do not (accept|agree)|don.?t (accept|agree))|no,? thanks|only (necessary|essential|required)|(necessary|essential) only|"
    r"use (only )?necessary|continue without accepting|"
    # French
    r"(tout |je )?refuser?( tout)?|continuer sans accepter|je n.?accepte pas|non,? merci|"
    r"(accepter |autoriser )?(uniquement|seulement) (les )?(cookies )?(strictement )?(n[eé]cessaires|essentiels)|"
    r"(cookies )?(strictement )?(n[eé]cessaires|essentiels) (uniquement|seulement)|"
    # German
    r"((alle|optionale|nicht notwendige)( [a-zäöüß-]+)? )?(cookies )?ablehnen|nicht (akzeptieren|zustimmen)|nein,? danke|"
    r"nur (technisch )?(notwendige|erforderliche|essenzielle|essentielle)|weiter ohne (zu )?(einwilligung|zustimmung|akzeptieren)|"
    # Spanish
    r"rechazar|no acepto|continuar sin aceptar|no,? gracias|"
    r"(aceptar |permitir )?(solo|sólo|únicamente) (las )?(cookies )?(necesarias|esenciales|t[eé]cnicas)|"
    # Portuguese
    r"rejeitar|recusar|continuar sem aceitar|n[aã]o aceito|n[aã]o,? obrigad[oa]|(aceitar )?(apenas|somente) (os )?(cookies )?(necess[aá]rios|essenciais)|"
    # Dutch
    r"(alles |alle cookies )?(weigeren|afwijzen)|(accepteer |sta )?alleen (noodzakelijke|functionele|essenti[eë]le)|nee,? bedankt|niet akkoord|"
    # Polish
    r"odrzu[cć]|odmawiam|odm[oó]w|nie zgadzam si[eę]|nie akceptuj[eę]|((za)?akceptuj |zezw[oó]l na )?tylko (niezb[eę]dne|wymagane)"
    r")",
    re.IGNORECASE,
)

# A reject that opens a subscription is not a rejection.
PAYWALL_IN_LABEL = re.compile(
    r"abbona|subscri|paga|acquista|premium|abonn|abonnier|abo\b|suscri|assin|bezahl|betal|subskry|prenumer",
    re.IGNORECASE,
)

# Only to describe a banner without a reject button (banner_type).
ACCEPT_PATTERN = re.compile(
    r"accett|accept|consent|agree|ok\b|va bene|ho capito|continua|"
    r"akzeptier|annehmen|zustimm|einverstanden|d'accord|autoriser|acept|aceit|concordo|"
    r"accepteren|akkoord|toestaan|akceptuj|zgadzam|zgoda",
    re.IGNORECASE,
)


def install(module):
    """Put these patterns in a module that uses them as globals (divergence_test)."""
    module.REJECT_PATTERN = REJECT_PATTERN
    module.PAYWALL_IN_LABEL = PAYWALL_IN_LABEL
    module.PAY_PATTERN = PAYWALL_IN_LABEL
    module.ACCEPT_PATTERN = ACCEPT_PATTERN


if __name__ == "__main__":
    # Quick check, the same labels as the extension's tests (choice.test.ts).
    reject = ["Rifiuta tutto", "Continua senza accettare", "Reject all", "Tout refuser", "Je refuse",
              "Accepter uniquement les cookies nécessaires", "Nur notwendige Cookies akzeptieren",
              "Optionale Cookies ablehnen", "Weiter ohne Einwilligung", "Rechazar todas", "Aceptar solo las necesarias",
              "Rejeitar todos", "Alles weigeren", "Alleen noodzakelijke cookies", "Odrzuć wszystkie", "Tylko niezbędne",
              # sample E, visit E1 (modification 24)
              "Alle Dienste ablehnen", "Non merci", "Odmawiam", "Nie zgadzam się", "I Do Not Accept",
              # sample F, visit F1 (modification 34)
              "Cookies nécessaires uniquement", "Weiter ohne zu akzeptieren", "Akceptuj tylko niezbędne", "Cookies : Deny all cookies"]
    not_reject = ["Accetta", "Alle akzeptieren", "Alle Dienste erlauben", "Einstellungen", "Paramètres", "Aceptar y cerrar", "Akkoord", "I Accept", "Zgadzam się",
                  "ablehnen, ändern oder widerrufen", "Einstellungen oder ablehnen", "Manage settings"]
    bad = [l for l in reject if not REJECT_PATTERN.search(l)] + [l for l in not_reject if REJECT_PATTERN.search(l)]
    paying = ["Ablehnen und Abo abschließen", "Rechazar y suscribirse", "Recusar e assinar"]
    bad += [l for l in paying if not PAYWALL_IN_LABEL.search(l)]
    print("ok" if not bad else f"wrong: {bad}")
