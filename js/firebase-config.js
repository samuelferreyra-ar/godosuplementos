import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_nRT4TtZ3j0PD59ThA6X52UV6mBbEE8M",
  authDomain: "godo-suplementos.firebaseapp.com",
  projectId: "godo-suplementos",
  storageBucket: "godo-suplementos.firebasestorage.app",
  messagingSenderId: "510768546229",
  appId: "1:510768546229:web:14bccb04999d67e71919fc",
  measurementId: "G-BTM3WVSW2N"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);