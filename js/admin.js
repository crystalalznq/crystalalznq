import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const form = document.getElementById("addProductForm");
const saveBtn = document.getElementById("saveBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  saveBtn.disabled = true;
  saveBtn.innerText = "جاري الحفظ في Firebase... ⏳";

  try {
    const productName = document.getElementById("pName").value;
    const category = document.getElementById("pCategory").value;
    const price = Number(document.getElementById("pPrice").value);
    const status = document.getElementById("pStatus").value;
    const imageUrl = document.getElementById("pImg").value;

    await addDoc(collection(db, "products"), {
      name: productName,
      category: category,
      price: price,
      status: status,
      imageUrl: imageUrl,
      createdAt: serverTimestamp()
    });

    alert("🎉 تم إضافة المنتج بنجاح في قاعدة البيانات!");
    form.reset();

  } catch (error) {
    console.error("خطأ أثناء الإضافة:", error);
    alert("❌ حصلت مشكلة: " + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "حفظ المنتج في الداتا بيز 🚀";
  }
});
