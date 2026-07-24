import { db } from "./firebase-config.js";
import { 
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==================== 1. إدارة المخزون والتنبيهات والمنتجات ====================

const productForm = document.getElementById("productForm");
const productsList = document.getElementById("productsList");
const saveProdBtn = document.getElementById("saveProdBtn");
const stockAlert = document.getElementById("stockAlert");
const stockAlertList = document.getElementById("stockAlertList");

async function loadProducts() {
  productsList.innerHTML = '';
  stockAlertList.innerHTML = '';
  let hasLowStock = false;

  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const pId = docSnap.id;

      const stockNum = Number(p.stock || 0);
      let stockBadge = `<span class="badge badge-ok">${stockNum} قطعة</span>`;

      // فحص المخزون للتنبيه
      if (stockNum === 0) {
        stockBadge = `<span class="badge badge-out">نفذت الكمية!</span>`;
        stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> نفذ من المخزون تماماً!</li>`;
        hasLowStock = true;
      } else if (stockNum <= 5) {
        stockBadge = `<span class="badge badge-low">متبقي ${stockNum} فقط!</span>`;
        stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> أوشك على الانتهاء (متبقي ${stockNum}).</li>`;
        hasLowStock = true;
      }

      stockAlert.style.display = hasLowStock ? "block" : "none";

      const priceDisplay = p.discountPrice 
        ? `<del style="color:#888;">${p.price}</del> ${p.discountPrice} ج`
        : `${p.price} ج`;

      const mainImg = (p.images && p.images.length > 0) ? p.images[0] : '';

      productsList.innerHTML += `
        <tr>
          <td><img src="${mainImg}" width="40" height="40" style="object-fit:cover; border-radius:4px;"></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td>${priceDisplay}</td>
          <td>${stockBadge}</td>
          <td>
            <button class="btn-action btn-edit" onclick="editProduct('${pId}', '${p.name}', '${p.category}', ${p.price}, '${p.discountPrice || ''}', ${stockNum}, '${(p.images || []).join(',')}', '${(p.colors || []).join(',')}', '${(p.sizes || []).join(',')}', \`${p.description || ''}\`)">تعديل</button>
            <button class="btn-action btn-delete" onclick="deleteProduct('${pId}')">حذف</button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error("خطأ في تحميل المنتجات:", error);
  }
}

// حفظ أو تعديل المنتج مع المخزون
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveProdBtn.disabled = true;

  const editId = document.getElementById("editProductId").value;
  const imagesArr = document.getElementById("pImages").value.split(',').map(img => img.trim()).filter(img => img);

  const productData = {
    name: document.getElementById("pName").value,
    category: document.getElementById("pCategory").value,
    stock: Number(document.getElementById("pStock").value),
    price: Number(document.getElementById("pPrice").value),
    discountPrice: document.getElementById("pDiscountPrice").value ? Number(document.getElementById("pDiscountPrice").value) : null,
    images: imagesArr,
    colors: document.getElementById("pColors").value.split(',').map(c => c.trim()).filter(c => c),
    sizes: document.getElementById("pSizes").value.split(',').map(s => s.trim()).filter(s => s),
    description: document.getElementById("pDescription").value,
    createdAt: serverTimestamp()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "products", editId), productData);
      alert("🎉 تم تعديل المنتج والمخزون بنجاح!");
      document.getElementById("editProductId").value = "";
      document.getElementById("productFormTitle").innerText = "إضافة منتج جديد";
    } else {
      await addDoc(collection(db, "products"), productData);
      alert("🎉 تم إضافة المنتج بنجاح!");
    }
    productForm.reset();
    loadProducts();
  } catch (error) {
    alert("❌ حدث خطأ: " + error.message);
  } finally {
    saveProdBtn.disabled = false;
  }
});

window.editProduct = (id, name, cat, price, discount, stock, images, colors, sizes, desc) => {
  document.getElementById("editProductId").value = id;
  document.getElementById("pName").value = name;
  document.getElementById("pCategory").value = cat;
  document.getElementById("pPrice").value = price;
  document.getElementById("pDiscountPrice").value = discount;
  document.getElementById("pStock").value = stock;
  document.getElementById("pImages").value = images;
  document.getElementById("pColors").value = colors;
  document.getElementById("pSizes").value = sizes;
  document.getElementById("pDescription").value = desc;

  document.getElementById("productFormTitle").innerText = "تعديل بيانات المنتج ✏️";
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProduct = async (id) => {
  if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
    await deleteDoc(doc(db, "products", id));
    loadProducts();
  }
};

// ==================== 2. إدارة الأقسام ====================

const categoryForm = document.getElementById("categoryForm");
const catParentSelect = document.getElementById("catParent");
const pCategorySelect = document.getElementById("pCategory");
const categoriesList = document.getElementById("categoriesList");

async function loadCategories() {
  catParentSelect.innerHTML = '<option value="root">-- قسم رئيسي --</option>';
  pCategorySelect.innerHTML = '<option value="">-- اختر القسم --</option>';
  categoriesList.innerHTML = '';

  try {
    const querySnapshot = await getDocs(collection(db, "categories"));
    querySnapshot.forEach((docSnap) => {
      const cat = docSnap.data();
      const catId = docSnap.id;
      const isSub = cat.parentId !== "root";

      catParentSelect.innerHTML += `<option value="${catId}">${cat.name}</option>`;
      pCategorySelect.innerHTML += `<option value="${cat.name}">${isSub ? '└-- ' : ''}${cat.name}</option>`;

      categoriesList.innerHTML += `
        <tr>
          <td><strong>${cat.name}</strong></td>
          <td>${isSub ? 'قسم فرعي' : 'قسم رئيسي'}</td>
          <td><button class="btn-action btn-delete" onclick="deleteCategory('${catId}')">حذف</button></td>
        </tr>
      `;
    });
  } catch (error) { console.error(error); }
}

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addDoc(collection(db, "categories"), {
    name: document.getElementById("catName").value,
    parentId: document.getElementById("catParent").value,
    createdAt: serverTimestamp()
  });
  categoryForm.reset();
  loadCategories();
});

window.deleteCategory = async (id) => {
  if (confirm("حذف القسم؟")) { await deleteDoc(doc(db, "categories", id)); loadCategories(); }
};

// ==================== 3. إدارة الكوبونات والعروض ====================

const couponForm = document.getElementById("couponForm");
const couponsList = document.getElementById("couponsList");

async function loadCoupons() {
  couponsList.innerHTML = '';
  try {
    const querySnapshot = await getDocs(collection(db, "coupons"));
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
  } catch (error) { console.error("خطأ الكوبونات:", error); }
}

couponForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const codeInput = document.getElementById("cCode").value.toUpperCase().trim();
  
  await addDoc(collection(db, "coupons"), {
    code: codeInput,
    discount: Number(document.getElementById("cDiscount").value),
    expireDate: document.getElementById("cExpireDate").value,
    createdAt: serverTimestamp()
  });

  alert("🎉 تم إضافة كود الخصم بنجاح!");
  couponForm.reset();
  loadCoupons();
});

window.deleteCoupon = async (id) => {
  if (confirm("هل تريد حذف هذا الكوبون؟")) {
    await deleteDoc(doc(db, "coupons", id));
    loadCoupons();
  }
};

// تشغيل التحميل التلقائي
loadProducts();
loadCategories();
loadCoupons();
