# API Routing System

Ce fichier décrit le système de routage centralisé de l'API Titan Academy.

## Structure

Toutes les routes API sont organisées dans `routes/index.js`, qui centralise et structure toutes les routes de l'application.

## Organisation des Routes

### Routes Publiques (Pas d'authentification requise)

- `/api/auth` - Authentification (login, register, logout, status)
- `/api/documents` - Opérations sur les documents
- `/api/tts` - Text-to-Speech
- `/api/qa` - Question-Answering
- `/api/audio` - Fichiers audio
- `/api/lab` - Laboratoire (legacy)

### Routes Protégées (Authentification requise)

#### Abonnements
- `/api/subscriptions` - Gestion des abonnements

#### Cours et Chapitres
- `/api/courses` - Gestion des cours (nécessite abonnement)
- `/api/courses/:courseId/chapters` - Chapitres d'un cours (nécessite abonnement)
- `/api/courses/:courseId/enroll` - Inscription à un cours
- `/api/courses/:courseId/subscriptions` - Abonnements pour un cours
- `/api/courses/:courseId/labs` - Labs d'un cours
- `/api/courses/:courseId/final-project` - Projet final d'un cours

#### Labs et Exercices
- `/api/labs` - Gestion des labs
- `/api/exercises` - Gestion des exercices

#### Utilisateurs
- `/api/users` - Gestion des utilisateurs
- `/api/users/me/courses` - Cours de l'utilisateur connecté
- `/api/users/:userId/enroll/:courseId` - Inscription admin d'un utilisateur

### Health Check

- `/api/health` - Vérification de l'état du serveur

## Middleware

Les routes utilisent différents niveaux de middleware :

1. **Public** : Aucun middleware
2. **requireAuth** : Authentification requise
3. **requireSubscription** : Authentification + abonnement actif requis

## Ajout de Nouvelles Routes

Pour ajouter une nouvelle route :

1. Créer un nouveau fichier dans `routes/` (ex: `newFeatureRoutes.js`)
2. Importer le fichier dans `routes/index.js`
3. Ajouter la route avec le middleware approprié dans `routes/index.js`

Exemple :

```javascript
// routes/newFeatureRoutes.js
const express = require('express');
const router = express.Router();
const newFeatureController = require('../controllers/newFeatureController');

router.get('/', newFeatureController.getAll);
router.post('/', newFeatureController.create);

module.exports = router;
```

```javascript
// routes/index.js
const newFeatureRoutes = require('./newFeatureRoutes');

// ...
router.use('/new-feature', requireAuth, newFeatureRoutes);
```

## Avantages

- **Organisation** : Toutes les routes sont centralisées dans un seul fichier
- **Maintenabilité** : Facile de voir toutes les routes et leurs middlewares
- **Scalabilité** : Facile d'ajouter de nouvelles routes
- **Documentation** : Structure claire et commentée
