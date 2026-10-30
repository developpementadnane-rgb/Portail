# Portail Membres — état au 30/10/2026

## Ce qui a changé par rapport au dépôt d'origine

### Inscription membres → table d'attente (bloc 3)
Avant : l'inscription créait directement un compte dans `users`, accès
immédiat après confirmation du PIN email.
Maintenant : l'inscription écrit dans `pending_registrations` (nouvelle
table, inaccessible à la clé publique anon). Le PIN email continue de
confirmer l'adresse, mais ne donne plus accès — il faut maintenant
qu'un chef authentifie la demande depuis le portail Chefs (page
"Demandes en attente") pour que le compte passe réellement dans `users`.
Une notification email est envoyée aux chefs à chaque nouvelle demande.
Fichiers modifiés : server/routes/auth.ts
Fichier nouveau : server/routes/registrationNotify.ts

## Pas encore fait sur ce portail
- La page AccountConfirmation.tsx génère encore l'ancien flux (QR/PDF
  immédiat côté client à l'inscription) — elle n'est normalement plus
  atteinte puisque l'inscription ne crée plus de compte actif, mais le
  code n'a pas été retiré. Vérifier qu'elle ne cause pas de confusion
  si un membre y arrive encore par un lien direct.
- Rien sur ce portail n'a été touché par le nettoyage de tables
  (attendance, trusted_devices, etc.) — ces tables n'étaient référencées
  que côté portail Chefs et App Rapports.

## À faire côté Adnane
- Tester le parcours complet : inscription → email PIN → attente →
  acceptation côté Chefs → réception des 3 documents par email
- Vérifier que le PIN email continue de fonctionner comme prévu dans
  ce nouveau flux (l'articulation exacte avait été laissée ouverte,
  confirmée depuis : le PIN confirme l'adresse dès l'inscription,
  indépendamment de l'approbation du chef)
