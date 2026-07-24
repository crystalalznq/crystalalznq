import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// بيانات مشروعك الحقيقية على فايربيس
const firebaseConfig = {
  apiKey: "AIzaSyASsdEASM5NEUZ7X71glbfMCVYw44WJUJI",
  authDomain: "crystalalznq-d6f7d.firebaseapp.com",
  projectId: "crystalalznq-d6f7d",
  storageBucket: "crystalalznq-d6f7d.firebasestorage.app",
  messagingSenderId: "825883317223",
  appId: "1:825883317223:web:18caa48d7dfb8c0664e342",
  measurementId: "G-SQBVZ03071"
};

// تشغيل وتصدير قاعدة البيانات
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

