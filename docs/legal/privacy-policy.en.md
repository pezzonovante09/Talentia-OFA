# Talentia Privacy Policy

> DRAFT FOR LEGAL REVIEW. Do not publish. App version: 1.0 (no cloud, no AI).
> Effective date: [[OWNER: effective date]]

## 1. Who we are

Data controller: [[OWNER: full legal name of the company, or name of the sole proprietor / individual,
address, registration number]].
Privacy contact: [[OWNER: contact email for privacy requests]].
Governing law and region: [[OWNER/LAWYER: operator's jurisdiction and the children's-data laws that
apply (COPPA, GDPR-K, Russian 152-FZ, Kyrgyz personal-data law, etc.); countries where the app will be
available]].

Talentia is an educational app for children aged 5-10 and their parents. A child uses the app;
settings, reports and data are available only to an adult behind a PIN.

## 2. In short

- In version 1 **all data stays on your device**. We do not create accounts, ask for an email, or
  send your child's data to our servers or to any third party.
- The app has no ads, no third-party analytics or advertising SDKs, no in-app purchases and no
  contact with other people. [[OWNER: confirm against the final dependency list before publishing.]]
- Tali (the helper) answers with ready-made lines stored in the app. No AI model is used.
- The microphone and camera are not used; the app has no access to contacts, location or photos.
- You can export or delete your child's data inside the app at any time.
  [[OWNER: there is no parent export screen yet, only the `exportChild` function (question 83, No. 184).
  By release: either an export screen, or remove the export promise here, in sections 7 and 8 and on
  the deletion page.]]

## 3. What data is processed on the device

| Data | Why | Where and for how long |
|---|---|---|
| Child profile: age band (5-6, 7, 8, 9-10), language, mode; a name only if the parent chooses to enter one (**optional**) | choose tasks and language | on the device until the profile is deleted |
| Learning progress: lesson runs (day, duration, task results), skill mastery | show progress, repeat difficult skills, parent report | on the device; the run log for 12 months by the device date, then deleted (if the app has not been opened for more than 45 days or the date jumped forward, deletion waits for an adult to confirm in the parent section and records may be kept longer until then; manual deletion is always available); the summary skill state while the profile exists |
| Parent consent log: what was confirmed, when, which text version | prove consent was given and withdrawn | on the device |
| Parent PIN (stored only as a salted hash in the system's secure storage), failed-attempt counter | keep the parent area away from the child | on the device |
| ABA mode data, **only if you turn the mode on and give a separate consent**: targets, trials, sessions, prompt levels, ratings, observer details, reward choices and time to choose, who the session was with | support ABA-style practice; trials are recorded only with consent | on the device; logs for 12 months |

ABA mode implies that a child may have developmental differences, so we treat these records as
**especially sensitive**, record them only after a separate explicit consent from an adult, and they
never leave the device. [[LAWYER: confirm the legal basis for processing data of this kind in the
chosen jurisdiction; owner's decision of 2026-10-01 is "yes for now, final with a lawyer".]]

The app does **not collect**: surname, date of birth, address, phone, email, photos, voice, precise
location, advertising identifier.

Backup of the app's data to the system cloud (iCloud, Google) is **disabled**: data does not reach it
without your knowledge. When you change devices it does not move by itself.
[[OWNER: whether export/import is part of version 1; if not, say plainly that data is lost with the
device.]]

## 4. Who receives data

No one. In version 1 the app sends no data about the child or parent off the device. If you export
data yourself and give the file to someone (a specialist, a teacher, another parent), what happens
next is your responsibility.

App stores (Apple App Store, Google Play) keep their own install and crash statistics under their own
rules; we receive anonymised summaries from them. [[OWNER: check what statistics you actually see in
the consoles.]]

## 5. What may come later (not enabled in version 1)

A cloud copy and adult sign-in by email, talking with Tali through AI, voice answers, specialist
access. Each such feature will be switched on **only by an adult, with a separate consent, and is off
by default**; before it ships this policy will be updated to name recipients, countries and retention
periods. Your child's data is not sent until you agree to the new version.

## 6. Parental consent

The app is meant for a child under an adult's supervision. During setup the parent creates a PIN and
confirms consent to storing data on the device. Age is checked with a simple arithmetic question: this
is a barrier against accidental entry by a child, **not** verified proof of age or parenthood.
[[LAWYER: is this mechanism sufficient for the chosen jurisdiction and store category; replace if not.]]

## 7. Children

- Talentia is an app for children aged 5-10, used by a child under an adult's supervision.
- A child's data does not leave the device: version 1 has no cloud, no accounts and no AI.
- The parent manages the child's data in the parent area behind a PIN: export, clear progress, delete
  the profile, withdraw consents. The child has no access to these actions. [[OWNER: see the export note in section 2.]]
- We deliberately do not collect more than needed (see section 3: no surname, date of birth, email,
  photos, voice, location or advertising identifier; the in-game name is optional and stays on the
  device) and do not share a child's data with third parties. The app has no ads and no third-party
  analytics SDKs.
- The age barrier during setup - an arithmetic question - protects against accidental entry by a child
  and is not verification of age or parenthood (section 6).

## 8. Your rights and retention

You may obtain a copy of the data (export) [[OWNER: see the export note in section 2.]], clear progress, delete the child's profile and withdraw
any consent. All of this is done in the app's parent area (PIN required) without contacting us,
because the data is only with you. Deletion is irreversible, there is no trash, and data is physically
erased from the device. Full deletion is the Delete account button in Data. Uninstalling the app erases its data; [[iOS: before release, the PIN hash in Keychain is cleared on reinstall, #157]].

After a child's profile is deleted, the consent log stays on the device without any link to the child
(the identifier is replaced with a random one) as evidence that consent was given and withdrawn.
"Delete everything on this device" also erases the consent log and the PIN: then nothing is left on the
device. [[LAWYER: log retention period - three years in the spec; confirm or shorten for the
on-device-only mode.]] [[OWNER/LAWYER: the "Delete everything" behaviour comes from the code (`purge.ts`,
`wipeDevice`); `PARENT.md` describes the log as surviving deletion - see the note in
`account-deletion.en.md`.]]

We cannot delete or correct data we do not have. For questions use the address in section 1. Response
time: [[OWNER/LAWYER: response deadline under the governing law]].

## 9. Security

The PIN is stored only as a hash in the system's secure storage; after failed attempts sign-in is
locked with a growing delay; the keypad layout is shuffled on every entry; the parent area closes when
the app goes to the background and after inactivity; the data file is excluded from backups; deleted
data is physically erased. No protection is absolute: if the device is unlocked and a child knows the
PIN, whoever holds the device can reach the data.

## 10. Changes to this policy

We will tell you in the app before material changes take effect and, where they affect a child's data,
ask for consent again. Archive of earlier versions: [[OWNER: where it is kept]].

## 11. Contact and complaints

[[OWNER: contact email]]. You may also contact the data-protection authority:
[[LAWYER: name of the supervisory authority in the chosen jurisdiction]].
