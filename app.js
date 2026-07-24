import { db } from "./firebase-config.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productsContainer = document.getElementById("productsContainer");
const loadingDiv = document.getElementById("loading");

// رقم الواتساب الخاص بالمتجر (غير الرقم ده لرقامك الحقيقي مع كود الدولة)
const whatsappNumber = "201000000000";

async function loadProducts() {
  try {
    // جلب المنتجات من Firestore مرتبة حسب أحدث تاريخ
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    loadingDiv.style.display = "none"; // إخفاء كلمة جاري التحميل

    if (querySnapshot.empty) {
      productsContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>لا توجد منتجات مضافة حاليًا.</p>";
      return;
    }

    querySnapshot.forEach((doc) => {
      const product = doc.data();

      // تحديد لون وحالة التوفر
      let statusClass = "status-available";
      if (product.status === "كمية محدودة") statusClass = "status-limited";
      if (product.status === "غير متوفر") statusClass = "status-unavailable";

      // رسالة الواتساب الجاهزة عند الضغط
      const waMessage = encodeURIComponent(`أهلاً كرستال الزنقة، حابب أطلب منتج: ${product.name} بسعر ${product.price} جنيه.`);

      // بناء كارت المنتج
      const productCard = `
        <div class="product-card">
          <img src="${product.imageUrl}" class="product-img" alt="${product.name}" onerror="this.src='https://via.placeholder.com/200?text=لا+توجد+صورة'">
          <div class="product-info">
            <div>
              <span class="status-badge ${statusClass}">${product.status}</span>
              <div class="product-title">${product.name}</div>
              <div class="product-category">القسم: ${product.category}</div>
            </div>
            <div>
              <div class="product-price">${product.price} جنيه</div>
              <a href="https://wa.me/${whatsappNumber}?text=${waMessage}" target="_blank" class="btn-buy">طلب عبر واتساب 💬</a>
            </div>
          </div>
        </div>
      `;

      productsContainer.innerHTML += productCard;
    });

  } catch (error) {
    console.error("خطأ في جلب البيانات:", error);
    loadingDiv.innerText = "❌ حدث خطأ أثناء تحميل المنتجات.";
  }
}

// تشغيل الدالة فور فتح الصفحة
loadProducts();
