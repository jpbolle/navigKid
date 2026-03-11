# NavigKid! - Prof Webapp

Interface web Next.js 15 (App Router) pour le professeur.

## Stack technique
- Next.js 15, Tailwind CSS v4 (@theme), TypeScript
- Firebase Firestore (modular SDK)
- API Claude (Anthropic) pour la génération de questions
- Polices : Playfair Display (titres), Inter (corps)

## Fonctionnalités implémentées
- Créer un questionnaire : titre, thèmes (tags), consignes, questions (texte libre ou QCM)
- Modifier un questionnaire existant (mode édition via ?edit=id)
- Génération IA de questions via Claude API (prompt pédagogique détaillé)
- QCM avec marquage des bonnes réponses (liseré vert, multi-réponses)
- Réorganisation des questions (monter/descendre)
- Points par question avec total automatique
- Corrigé & références par question (réponse attendue + URLs de référence)
- Authentification professeur (AuthProvider)

## Fonctionnalités à implémenter
- Page résultats (/results?id=)
- Page analyse (/analyse?id=)
- Règles de sécurité Firestore
- Index composite Firestore
- Migration config Firebase vers variables d'environnement

## Structure principale
- src/components/CreateContent.tsx : formulaire principal de création/édition
- src/components/Header.tsx : en-tête NavigKid!
- src/components/AuthProvider.tsx : contexte d'authentification
- src/lib/types.ts : interfaces Question, Questionnaire
- src/lib/firebase.ts : fonctions Firestore (save, update, get)
- src/app/api/generer-questions/route.ts : endpoint Claude API
- src/app/globals.css : thème et styles globaux

Connexion à Firestore pour stocker questionnaires et réponses.
Interaction avec l'extension Chrome via Firestore (collection "questionnaires").