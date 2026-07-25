import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ اكتب رقم الواتساب الخاص بالمتجر هنا (بدون + كود الدولة 20 لمصر)
const STORE_PHONE_NUMBER = "201000000000"; 

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('crystal_cart')) || [];
let activeCouponDiscount = 0;

// 1. تحميل المنتجات من Firebase
async function fetchProducts() {
  const productsGrid = document.getElementById("productsGrid");
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    allProducts = [];

    querySnapshot.forEach((doc) => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });

    renderProducts(allProducts);
    loadCategories(allProducts);
    updateCartUI();
  } catch (error) {
    console.error("خطأ في تحميل المنتجات:", error);
    productsGrid.innerHTML = `<p style="text-align:center; color:red; grid-column: 1/-1;">عذراً، حدث خطأ أثناء تحميل المنتجات.</p>`;
  }
}

// 2. عرض المنتجات في الشبكة
function renderProducts(products) {
  const productsGrid = document.getElementById("productsGrid");
  productsGrid.innerHTML = "";

  if (products.length === 0) {
    productsGrid.innerHTML = `<p style="text-align:center; color:#7f8c8d; grid-column: 1/-1; padding:40px;">لا توجد منتجات متوفرة حالياً.</p>`;
    return;
  }

  products.forEach((p) => {
    // حساب الخصومات المضبوطة
    const hasDiscount = p.discountPrice && Number(p.discountPrice) < Number(p.price);
    const finalPrice = hasDiscount ? Number(p.discountPrice) : Number(p.price);
    const mainImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/200?text=لا+صورة';

    // إعداد المواصفات (الألوان والمقاسات)
    let specsHtml = '';
    if (p.colors && p.colors.length > 0) specsHtml += `<span class="spec-item">🎨 ${p.colors.join(', ')}</span>`;
    if (p.sizes && p.sizes.length > 0) specsHtml += `<span class="spec-item">📏 ${p.sizes.join(', ')}</span>`;

    productsGrid.innerHTML += `
      <div class="product-card">
        ${hasDiscount ? `<span class="discount-badge">خصم!</span>` : ''}
        <img src="${mainImg}" class="product-img" alt="${p.name}">
        <div class="product-info">
          <div>
            <h3 class="product-title">${p.name}</h3>
            <div class="product-specs">${specsHtml}</div>
          </div>
          <div>
            <div class="price-box">
              <span class="current-price">${finalPrice} جنيه</span>
              ${hasDiscount ? `<span class="old-price">${p.price} جنيه</span>` : ''}
            </div>
            <button class="add-to-cart-btn" onclick="addToCart('${p.id}')">إضافة للسلة 🛒</button>
          </div>
        </div>
      </div>
    `;
  });
}

// 3. شريط الأقسام الأوتوماتيكي
function loadCategories(products) {
  const categoriesBar = document.getElementById("categoriesBar");
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  categoriesBar.innerHTML = categories.map(cat => `
    <button class="cat-chip ${cat === 'all' ? 'active' : ''}" onclick="filterCategory('${cat}', this)">
      ${cat === 'all' ? 'الكل 🌟' : cat}
    </button>
  `).join('');
}

window.filterCategory = (categoryName, btn) => {
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (categoryName === 'all') {
    renderProducts(allProducts);
  } else {
    const filtered = allProducts.filter(p => p.category === categoryName);
    renderProducts(filtered);
  }
};

// 4. إدارة السلة وحفظها
window.addToCart = (productId) => {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    const price = (product.discountPrice && Number(product.discountPrice) < Number(product.price)) 
      ? Number(product.discountPrice) 
      : Number(product.price);
    
    cart.push({
      id: product.id,
      name: product.name,
      price: price,
      img: (product.images && product.images[0]) || '',
      qty: 1
    });
  }

  saveCart();
  updateCartUI();
  toggleCart(true); // فتح السلة عند الإضافة
};

window.updateQty = (id, change) => {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.qty += change;
    if (item.qty <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
  }
  saveCart();
  updateCartUI();
};

function saveCart() {
  localStorage.setItem('crystal_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const cartBadge = document.getElementById("cartBadge");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  cartBadge.innerText = totalQty;

  if (cart.length === 0) {
    cartItems.innerHTML = `<p style="text-align:center; color:#7f8c8d; margin-top:40px;">السلة فارغة حالياً</p>`;
    cartTotal.innerText = "0 جنيه";
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.img || 'https://via.placeholder.com/60'}" class="cart-item-img">
      <div class="cart-item-details">
        <h4 style="font-size:14px; margin-bottom:4px;">${item.name}</h4>
        <div style="font-size:13px; color:var(--primary); font-weight:bold;">${item.price} جنيه</div>
        <div style="margin-top:5px; display:flex; align-items:center; gap:8px;">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </div>
    </div>
  `).join('');

  // حساب الإجمالي مع الخصومات
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let finalTotal = subtotal - (subtotal * (activeCouponDiscount / 100));

  cartTotal.innerText = `${finalTotal.toFixed(2)} جنيه`;
}

// 5. فتح وإغلاق السلة
window.toggleCart = (forceOpen = false) => {
  const cartModal = document.getElementById("cartModal");
  const overlay = document.getElementById("overlay");
  
  if (forceOpen || !cartModal.classList.contains("open")) {
    cartModal.classList.add("open");
    overlay.classList.add("open");
  } else {
    cartModal.classList.remove("open");
    overlay.classList.remove("open");
  }
};

// 6. البحث المباشر
document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  const filtered = allProducts.filter(p => 
    p.name.toLowerCase().includes(term) || 
    (p.category && p.category.toLowerCase().includes(term))
  );
  renderProducts(filtered);
});

// 7. إرسال الطلب عبر الواتساب بشكل منسق
window.sendWhatsAppOrder = () => {
  if (cart.length === 0) {
    alert("السلة فارغة! أضف منتجات أولاً.");
    return;
  }

  const deliveryMethod = document.getElementById("deliveryMethod").value === "delivery" ? "🚛 توصيل للمنزل" : "🏪 حجز واستلام من المحل";
  
  let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let finalTotal = subtotal - (subtotal * (activeCouponDiscount / 100));

  let message = `مرحباً كرستال الزنقة 💎، أود تأكيد الطلب التالي:\n\n`;
  
  cart.forEach((item, index) => {
    message += `${index + 1}. *${item.name}*\n   العدد: ${item.qty} | السعر: ${item.price * item.qty} جنيه\n`;
  });

  message += `\n-----------------------\n`;
  message += `📌 *طريقة الاستلام:* ${deliveryMethod}\n`;
  if (activeCouponDiscount > 0) {
    message += `🎟️ *خصم الكوبون:* ${activeCouponDiscount}%\n`;
  }
  message += `💰 *الإجمالي النهائي:* ${finalTotal.toFixed(2)} جنيه\n\n`;
  message += `يرجى تأكيد الطلب والتفاصيل!`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${STORE_PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
};

// تشغيل عند التحميل
fetchProducts();
