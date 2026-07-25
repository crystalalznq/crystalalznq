import { db } from "./firebase-config.js";
import { 
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==================== مصفوفة تخزين صور المنتج الحالي ====================
let activeProductImages = []; // تحتوي على روابط الصور أو نصوص Base64

// دالة ضغط الصور المرفوعة من الملفات تحويلها لـ Base64
function compressAndConvertToBase64(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// عرض معاينة الصور ورسم أزرار الإزالة (X)
function renderImagePreview() {
  const previewContainer = document.getElementById("imagePreview");
  previewContainer.innerHTML = "";

  activeProductImages.forEach((imgSrc, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "img-wrapper";

    const img = document.createElement("img");
    img.src = imgSrc;
    img.className = "img-preview";

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

// حذف صورة محددة باستخدام علامة (X)
function removeImage(index) {
  activeProductImages.splice(index, 1);
  renderImagePreview();
}

// إضافة صور من المعرض
document.getElementById("pImgFiles").addEventListener("change", async (e) => {
  const files = e.target.files;
  for (let file of files) {
    try {
      const base64Img = await compressAndConvertToBase64(file);
      activeProductImages.push(base64Img);
    } catch (err) {
      console.error("خطأ في قراءة الصورة:", err);
    }
  }
  e.target.value = ""; // إعادة تعيين لتمكين اختيار صور مجدداً
  renderImagePreview();
});

// إضافة صورة عبر رابط مباشر
document.getElementById("addUrlBtn").addEventListener("click", () => {
  const urlInput = document.getElementById("pImgUrlInput");
  const urls = urlInput.value.split(',').map(u => u.trim()).filter(u => u);

  if (urls.length > 0) {
    urls.forEach(url => activeProductImages.push(url));
    urlInput.value = "";
    renderImagePreview();
  } else {
    alert("يرجى إدخال رابط صورة صحيح!");
  }
});

// ==================== 1. إدارة المنتجات والمخزون ====================

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

      if (stockNum === 0) {
        stockBadge = `<span class="badge badge-out">نفذت الكمية!</span>`;
        stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> نفذ من المخزون!</li>`;
        hasLowStock = true;
      } else if (stockNum <= 5) {
        stockBadge = `<span class="badge badge-low">متبقي ${stockNum} قطع!</span>`;
        stockAlertList.innerHTML += `<li>المنتج <strong>${p.name}</strong> أوشك على الانتهاء (متبقي ${stockNum}).</li>`;
        hasLowStock = true;
      }

      stockAlert.style.display = hasLowStock ? "block" : "none";

      const priceDisplay = p.discountPrice 
        ? `<del style="color:#888;">${p.price}</del> ${p.discountPrice} ج`
        : `${p.price} ج`;

      const mainImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/40?text=لا+صورة';

      // تجهيز بيانات المنتجات للتعديل برمجياً
      const imagesJson = JSON.stringify(p.images || []).replace(/"/g, '&quot;');

      productsList.innerHTML += `
        <tr>
          <td><img src="${mainImg}" width="40" height="40" style="object-fit:cover; border-radius:4px;"></td>
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
  } catch (error) {
    console.error("خطأ في تحميل المنتجات:", error);
  }
}

// حفظ أو تعديل المنتج
productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (activeProductImages.length === 0) {
    alert("⚠️ يرجى إضافة صورة واحدة على الأقل للمنتج سواء من المعرض أو عبر رابط!");
    return;
  }

  saveProdBtn.disabled = true;
  saveProdBtn.innerText = "جاري حفظ البيانات... ⏳";

  const editId = document.getElementById("editProductId").value;

  try {
    const productData = {
      name: document.getElementById("pName").value,
      category: document.getElementById("pCategory").value,
      stock: Number(document.getElementById("pStock").value),
      price: Number(document.getElementById("pPrice").value),
      discountPrice: document.getElementById("pDiscountPrice").value ? Number(document.getElementById("pDiscountPrice").value) : null,
      images: activeProductImages,
      colors: document.getElementById("pColors").value.split(',').map(c => c.trim()).filter(c => c),
      sizes: document.getElementById("pSizes").value.split(',').map(s => s.trim()).filter(s => s),
      description: document.getElementById("pDescription").value,
      createdAt: serverTimestamp()
    };

    if (editId) {
      await updateDoc(doc(db, "products", editId), productData);
      alert("🎉 تم تعديل المنتج بنجاح!");
      document.getElementById("editProductId").value = "";
      document.getElementById("productFormTitle").innerText = "إضافة منتج جديد";
    } else {
      await addDoc(collection(db, "products"), productData);
      alert("🎉 تم إضافة المنتج والصور بنجاح!");
    }

    productForm.reset();
    activeProductImages = [];
    renderImagePreview();
    loadProducts();

  } catch (error) {
    alert("❌ حدث خطأ أثناء الحفظ: " + error.message);
  } finally {
    saveProdBtn.disabled = false;
    saveProdBtn.innerText = "حفظ المنتج والمخزون 🚀";
  }
});

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

  try {
    activeProductImages = JSON.parse(imagesJson);
  } catch (e) {
    activeProductImages = [];
  }
  renderImagePreview();

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
  catParentSelect.innerHTML = '<option value="root">-- قسم رئيسي مستقل --</option>';
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
  if (confirm("حذف هذا القسم؟")) { await deleteDoc(doc(db, "categories", id)); loadCategories(); }
};

// ==================== 3. الكوبونات والعروض ====================

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
  } catch (error) { console.error(error); }
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

  alert("🎉 تم إضافة الكوبون بنجاح!");
  couponForm.reset();
  loadCoupons();
});

window.deleteCoupon = async (id) => {
  if (confirm("حذف هذا الكوبون؟")) {
    await deleteDoc(doc(db, "coupons", id));
    loadCoupons();
  }
};

// تشغيل القوائم عند التحميل
loadProducts();
loadCategories();
loadCoupons();
