import { db } from "./firebase-config.js";
import { 
  collection, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==================== مصفوفة تخزين روابط صور المنتج الحالي ====================
let activeProductImages = []; 

// عرض معاينة الصور ورسم أزرار الإزالة (X)
function renderImagePreview() {
  const previewContainer = document.getElementById("imagePreview");
  if (!previewContainer) return;
  previewContainer.innerHTML = "";

  activeProductImages.forEach((imgSrc, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-wrapper";

    const img = document.createElement("img");
    img.src = imgSrc;
    img.className = "img-preview";
    img.onerror = () => { img.src = "https://via.placeholder.com/60?text=خطأ+بالرابط"; };

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-img-btn";
    removeBtn.innerText = "✕";
    removeBtn.onclick = () => removeImage(index);

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    previewContainer.appendChild(wrapper);
  });
}

function removeImage(index) {
  activeProductImages.splice(index, 1);
  renderImagePreview();
}

// إضافة روابط الصور مع التحقق من صحتها
const addUrlBtn = document.getElementById("addUrlBtn");
if (addUrlBtn) {
  addUrlBtn.addEventListener("click", () => {
    const urlInput = document.getElementById("pImgUrlInput");
    if (!urlInput) return;

    const urls = urlInput.value
      .split(",")
      .map(url => url.trim())
      .filter(url => url);

    if (urls.length === 0) {
      alert("⚠️ يرجى إدخال رابط صورة صحيح!");
      return;
    }

    urls.forEach(url => {
      const isValidProtocol = url.startsWith("http://") || url.startsWith("https://");
      const isLikelyImage = 
        url.includes("ibb.co") || 
        url.includes("imgur.com") || 
        /\.(jpg|jpeg|png|webp|gif|avif)($|\?)/i.test(url);

      if (isValidProtocol && isLikelyImage) {
        activeProductImages.push(url);
      } else {
        alert(`❌ الرابط التالي غير صالح أو ليس رابط صورة مباشر:\n${url}`);
      }
    });

    urlInput.value = "";
    renderImagePreview();
  });
}

// ==================== 1. إدارة المنتجات والمخزون ====================

const productForm = document.getElementById("productForm");
const productsList = document.getElementById("productsList");
const saveProdBtn = document.getElementById("saveProdBtn");
const stockAlert = document.getElementById("stockAlert");
const stockAlertList = document.getElementById("stockAlertList");

function initProductsListener() {
  if (!productsList) return;
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  
  onSnapshot(q, (querySnapshot) => {
    productsList.innerHTML = '';
    if (stockAlertList) stockAlertList.innerHTML = '';
    let hasLowStock = false;

    querySnapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const pId = docSnap.id;

      const stockNum = Number(p.stock || 0);
      let stockBadge = `<span class="badge badge-ok">${stockNum} قطعة</span>`;

      if (stockNum === 0) {
        stockBadge = `<span class="badge badge-out">نفذت الكمية!</span>`;
        if (stockAlertList) stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> نفذ من المخزون!</li>`;
        hasLowStock = true;
      } else if (stockNum <= 5) {
        stockBadge = `<span class="badge badge-low">متبقي ${stockNum} قطع!</span>`;
        if (stockAlertList) stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> أوشك على الانتهاء (متبقي ${stockNum}).</li>`;
        hasLowStock = true;
      }

      if (stockAlert) stockAlert.style.display = hasLowStock ? "block" : "none";

      const priceDisplay = p.discountPrice 
        ? `<del style="color:#888;">${p.price}</del> ${p.discountPrice} ج`
        : `${p.price} ج`;

      const mainImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/40?text=لا+صورة';
      const imagesJson = JSON.stringify(p.images || []).replace(/"/g, '&quot;');

      productsList.innerHTML += `
        <tr>
          <td><img src="${mainImg}" width="40" height="40" style="object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/40?text=خطأ'"></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td>${priceDisplay}</td>
          <td>${stockBadge}</td>
          <td>
            <button class="btn-action btn-edit" onclick="editProduct('${pId}', '${p.name}', '${p.category}', ${p.price}, '${p.discountPrice || ''}', ${stockNum}, '${(p.colors || []).join(',')}', '${(p.sizes || []).join(',')}', \`${p.description || ''}\`, '${imagesJson}')">تعديل</button>
            <button class="btn-action btn-delete" onclick="deleteProduct('${pId}')">حذف</button>
          </td>
        </tr>
      `;
    });
  });
}

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (activeProductImages.length === 0) {
      alert("⚠️ يرجى إضافة رابط صورة واحد على الأقل للمنتج!");
      return;
    }

    if (saveProdBtn) {
      saveProdBtn.disabled = true;
      saveProdBtn.innerText = "جاري الحفظ... ⏳";
    }

    const editId = document.getElementById("editProductId").value;

    try {
      // تجهيز بيانات المنتج المشتركة
      const productData = {
        name: document.getElementById("pName").value,
        category: document.getElementById("pCategory").value,
        stock: Number(document.getElementById("pStock").value),
        price: Number(document.getElementById("pPrice").value),
        discountPrice: document.getElementById("pDiscountPrice").value ? Number(document.getElementById("pDiscountPrice").value) : null,
        images: activeProductImages,
        colors: document.getElementById("pColors").value.split(',').map(c => c.trim()).filter(c => c),
        sizes: document.getElementById("pSizes").value.split(',').map(s => s.trim()).filter(s => s),
        description: document.getElementById("pDescription").value
      };

      if (editId) {
        // عند التعديل: نقوم بالتحديث فقط دون المساس بـ createdAt لكي يظل الترتيب كما هو
        await updateDoc(doc(db, "products", editId), productData);
        alert("🎉 تم تعديل المنتج بنجاح دون تغيير ترتيبه!");
        document.getElementById("editProductId").value = "";
        const formTitle = document.getElementById("productFormTitle");
        if (formTitle) formTitle.innerText = "إضافة منتج جديد";
      } else {
        // عند الإضافة لأول مرة: نضيف حقل createdAt ليظهر في أعلى القائمة
        productData.createdAt = serverTimestamp();
        await addDoc(collection(db, "products"), productData);
        alert("🎉 تم إضافة المنتج بنجاح!");
      }

      productForm.reset();
      activeProductImages = [];
      renderImagePreview();

    } catch (error) {
      alert("❌ حدث خطأ: " + error.message);
    } finally {
      if (saveProdBtn) {
        saveProdBtn.disabled = false;
        saveProdBtn.innerText = "حفظ المنتج والمخزون 🚀";
      }
    }
  });
}

window.editProduct = (id, name, cat, price, discount, stock, colors, sizes, desc, imagesJson) => {
  document.getElementById("editProductId").value = id;
  document.getElementById("pName").value = name;
  document.getElementById("pCategory").value = cat;
  document.getElementById("pPrice").value = price;
  document.getElementById("pDiscountPrice").value = discount;
  document.getElementById("pStock").value = stock;
  document.getElementById("pColors").value = colors;
  document.getElementById("pSizes").value = sizes;
  document.getElementById("pDescription").value = desc;

  try { activeProductImages = JSON.parse(imagesJson); } catch (e) { activeProductImages = []; }
  renderImagePreview();

  const formTitle = document.getElementById("productFormTitle");
  if (formTitle) formTitle.innerText = "تعديل بيانات المنتج ✏️";
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
    await deleteDoc(doc(db, "products", id));
  }
};

// ==================== 2. إدارة الأقسام ====================

const categoryForm = document.getElementById("categoryForm");
const catParentSelect = document.getElementById("catParent");
const pCategorySelect = document.getElementById("pCategory");
const categoriesList = document.getElementById("categoriesList");

function initCategoriesListener() {
  onSnapshot(collection(db, "categories"), (querySnapshot) => {
    if (catParentSelect) catParentSelect.innerHTML = '<option value="root">-- قسم رئيسي مستقل --</option>';
    if (pCategorySelect) pCategorySelect.innerHTML = '<option value="">-- اختر القسم --</option>';
    if (categoriesList) categoriesList.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const cat = docSnap.data();
      const catId = docSnap.id;
      const isSub = cat.parentId !== "root";

      if (catParentSelect) catParentSelect.innerHTML += `<option value="${catId}">${cat.name}</option>`;
      if (pCategorySelect) pCategorySelect.innerHTML += `<option value="${cat.name}">${isSub ? '└-- ' : ''}${cat.name}</option>`;

      if (categoriesList) {
        categoriesList.innerHTML += `
          <tr>
            <td><strong>${cat.name}</strong></td>
            <td>${isSub ? 'قسم فرعي' : 'قسم رئيسي'}</td>
            <td><button class="btn-action btn-delete" onclick="deleteCategory('${catId}')">حذف</button></td>
          </tr>
        `;
      }
    });
  });
}

if (categoryForm) {
  categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "categories"), {
      name: document.getElementById("catName").value,
      parentId: document.getElementById("catParent").value,
      createdAt: serverTimestamp()
    });
    categoryForm.reset();
  });
}

window.deleteCategory = async (id) => {
  if (confirm("حذف هذا القسم؟")) { await deleteDoc(doc(db, "categories", id)); }
};

// ==================== 3. الكوبونات والعروض ====================

const couponForm = document.getElementById("couponForm");
const couponsList = document.getElementById("couponsList");

function initCouponsListener() {
  if (!couponsList) return;
  onSnapshot(collection(db, "coupons"), (querySnapshot) => {
    couponsList.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
      const c = docSnap.data();
      const cId = docSnap.id;

      couponsList.innerHTML += `
        <tr>
          <td><strong style="color:var(--primary);">${c.code}</strong></td>
          <td>${c.discount}% الخصم</td>
          <td>${c.expireDate}</td>
          <td><button class="btn-action btn-delete" onclick="deleteCoupon('${cId}')">حذف</button></td>
        </tr>
      `;
    });
  });
}

if (couponForm) {
  couponForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById("cCode").value.toUpperCase().trim();
    
    await addDoc(collection(db, "coupons"), {
      code: codeInput,
      discount: Number(document.getElementById("cDiscount").value),
      expireDate: document.getElementById("cExpireDate").value,
      createdAt: serverTimestamp()
    });

    alert("🎉 تم إضافة الكوبون بنجاح!");
    couponForm.reset();
  });
}

window.deleteCoupon = async (id) => {
  if (confirm("حذف هذا الكوبون؟")) { await deleteDoc(doc(db, "coupons", id)); }
};

// تشغيل المستمعات اللحظية عند التحميل
initProductsListener();
initCategoriesListener();
initCouponsListener();
