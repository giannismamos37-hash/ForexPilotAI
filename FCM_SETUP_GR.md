# ForexPilot AI — Firebase Push Setup (Greek)

Ο server-side scanner και τα endpoints για push έχουν ενσωματωθεί. Για πραγματικά push notifications χρειάζεται να συνδεθεί ένα Firebase project και να προστεθούν οι ρυθμίσεις στο Render.

## 1. Firebase
1. Δημιούργησε Firebase project.
2. Πρόσθεσε Web App και κράτησε τα στοιχεία Web config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3. Firebase Console → Cloud Messaging → Web Push certificates → δημιούργησε/αντέγραψε VAPID public key.
4. Στο Google Cloud για το ίδιο project ενεργοποίησε Firebase Cloud Messaging API και δημιούργησε service account που έχει δικαίωμα αποστολής FCM (Firebase Admin ή Firebase Cloud Messaging Admin). Κατέβασε το JSON key. **Μην το ανεβάσεις στο GitHub και μην το στείλεις σε chat.**

## 2. Render environment variables
Render → service forexpilot-ai-api → Environment. Πρόσθεσε:
- FIREBASE_API_KEY
- FIREBASE_AUTH_DOMAIN
- FIREBASE_PROJECT_ID
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
- FCM_VAPID_KEY (public VAPID key από Firebase Web Push certificates)
- FIREBASE_SERVICE_ACCOUNT_JSON (ολόκληρο το service-account JSON ως μία τιμή environment variable)
- TWELVE_DATA_API_KEY (ήδη απαιτείται για market data)

Μετά κάνε Save/Deploy. Το health endpoint `/api/health` πρέπει να επιστρέφει `pushConfigured: true`.

## 3. Σύνδεση κινητού
1. Άνοιξε το ForexPilot AI από το HTTPS site στο Android.
2. Στον Global Opportunity Scanner πάτησε «Ενεργοποίηση ειδοποιήσεων κινητού».
3. Αποδέξου την άδεια Android/browser.
4. Ο server θα αποθηκεύσει το FCM registration token και θα δείξει registeredDevices στο health endpoint.

## Τι κάνει ο server
- Σαρώνει τα υποστηριζόμενα σύμβολα κάθε 3 λεπτά στο 15-minute timeframe.
- Στέλνει νέα BUY/SELL alerts με Entry, SL και TP.
- Παρακολουθεί trades που καταχωρούνται από το Paper Trading για SL/TP και στέλνει notification όταν χτυπήσει επίπεδο.
- Τα trades/tokens προς το παρόν αποθηκεύονται σε τοπικό αρχείο ή μνήμη server. Σε Render ephemeral filesystem/free instance μπορεί να χαθούν σε restart/redeploy. Για αξιόπιστη 24/5 λειτουργία χρειάζεται always-on instance και persistent storage/managed database.

## Σημαντικό
- Οι ειδοποιήσεις είναι alerts/demo monitoring — δεν εκτελούν πραγματικές εντολές σε broker.
- Το scanner έχει απλό κανόνα EMA 9/21, RSI και candle direction με ATR-based SL και 1:2 TP. Δεν είναι πιστή πλήρης υλοποίηση των βιβλίων ούτε αποδεδειγμένο profitable strategy.
- API quotas του Twelve Data μπορεί να περιορίσουν το scan/monitoring.
