// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔐 Tu configuración de Firebase (copiala desde Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyB_nRT4TtZ3j0PD59ThA6X52UV6mBbEE8M",
  authDomain: "godo-suplementos.firebaseapp.com",
  projectId: "godo-suplementos",
  storageBucket: "godo-suplementos.firebasestorage.app",
  messagingSenderId: "510768546229",
  appId: "1:510768546229:web:14bccb04999d67e71919fc",
  measurementId: "G-BTM3WVSW2N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
