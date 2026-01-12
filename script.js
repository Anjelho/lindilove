const sheetCsvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5Y9SskoVGkOZ80BIAsUOb9gHX4CzPbacMf1_GmfsFZulmKCe30sx24GyhQ8JpCkCfLH5wNHyZAcmV/pub?output=csv";
const storeCacheKey = "lindilove-store-cache";
const storeCacheTtlMs = 10 * 60 * 1000;

const fallbackStore = {
  categories: ["Свещи", "Сапунени цветя"],
  tags: ["14 февруари", "Рожден ден", "Кръщене"],
  products: [
    {
      id: 1,
      name: "Свещ - Ванилия и бял чай",
      price: "24 лв.",
      category: "Свещи",
      note: "Създадена за уютни вечери",
      image: "images/candle-vanilla.svg",
      tags: ["14 февруари"],
      gallery: [],
    },
    {
      id: 2,
      name: "Свещ - Палава малина",
      price: "22 лв.",
      category: "Свещи",
      note: "Сладък плодово-флорален аромат",
      image: "images/candle-raspberry.svg",
      tags: ["Рожден ден"],
      gallery: [],
    },
    {
      id: 3,
      name: "Свещ - Лаванда и кедър",
      price: "26 лв.",
      category: "Свещи",
      note: "Дълбок релакс след дълъг ден",
      image: "images/candle-lavender.svg",
      tags: ["Кръщене"],
      gallery: [],
    },
    {
      id: 4,
      name: "Сапунени цветя - Розова градина",
      price: "32 лв.",
      category: "Сапунени цветя",
      note: "Ръчно аранжиран букет",
      image: "images/flower-rose.svg",
      tags: ["14 февруари", "Рожден ден"],
      gallery: [],
    },
    {
      id: 5,
      name: "Сапунени цветя - Пудра божури",
      price: "34 лв.",
      category: "Сапунени цветя",
      note: "Нежни пастелни тонове",
      image: "images/flower-peony.svg",
      tags: ["Рожден ден"],
      gallery: [],
    },
    {
      id: 6,
      name: "Сапунени цветя - Слънчеви лилии",
      price: "30 лв.",
      category: "Сапунени цветя",
      note: "Светло и свежо ухание",
      image: "images/flower-lily.svg",
      tags: ["Кръщене"],
      gallery: [],
    },
  ],
};

const normalizeText = (value) => (value || "").trim();

const splitCsvLine = (line, delimiter) => {
  const pattern =
    delimiter === ";"
      ? /;(?=(?:[^"]*"[^"]*")*[^"]*$)/
      : /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
  return line
    .split(pattern)
    .map((item) => item.replace(/^"|"$/g, "").trim());
};

const pickDelimiter = (line) => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  if (semicolonCount > commaCount) {
    return ";";
  }
  return ",";
};

const defaultHeaders = [
  "id",
  "name",
  "price",
  "category",
  "note",
  "image",
  "tags",
  "gallery",
];

const parseCsv = (text) => {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const headerLine = lines.shift();
  const delimiter = pickDelimiter(headerLine);
  const rawHeaders = splitCsvLine(headerLine, delimiter).map((header) =>
    header.toLowerCase()
  );
  const hasNamedHeaders = rawHeaders.some((header) =>
    defaultHeaders.includes(header)
  );
  const headers = hasNamedHeaders ? rawHeaders : defaultHeaders;
  const dataLines = hasNamedHeaders ? lines : [headerLine, ...lines];

  return dataLines.map((line) => {
    const values = splitCsvLine(line, delimiter);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] || "";
      return acc;
    }, {});
  });
};

const mapProducts = (rows) =>
  rows
    .map((row, index) => {
      const tags = normalizeText(row.tags)
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      const gallery = normalizeText(row.gallery)
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      return {
        id: Number(row.id) || index + 1,
        name: normalizeText(row.name),
        price: normalizeText(row.price),
        category: normalizeText(row.category),
        note: normalizeText(row.note),
        image: normalizeText(row.image),
        tags,
        gallery,
      };
    })
    .filter((product) => product.name && product.category);

const buildStoreFromProducts = (products) => {
  const categories = Array.from(
    new Set(products.map((product) => product.category))
  );
  const tags = Array.from(
    new Set(products.flatMap((product) => product.tags || []))
  );
  return {
    categories,
    tags,
    products,
  };
};

const loadStore = async () => {
  if (!sheetCsvUrl || sheetCsvUrl.includes("PASTE")) {
    return fallbackStore;
  }
  const cached = sessionStorage.getItem(storeCacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < storeCacheTtlMs) {
        return parsed.data;
      }
    } catch {
      sessionStorage.removeItem(storeCacheKey);
    }
  }
  try {
    const response = await fetch(sheetCsvUrl, { cache: "no-store" });
    if (!response.ok) {
      return fallbackStore;
    }
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    const rows = parseCsv(text);
    const products = mapProducts(rows);
    if (!products.length) {
      return fallbackStore;
    }
    const data = buildStoreFromProducts(products);
    sessionStorage.setItem(
      storeCacheKey,
      JSON.stringify({ timestamp: Date.now(), data })
    );
    return data;
  } catch {
    return fallbackStore;
  }
};

let store = fallbackStore;

const getProductLink = (product) =>
  `product.html?id=${encodeURIComponent(product.id)}`;

const getProductImage = (product) =>
  product.image ? product.image : "images/gallery-1.svg";

const renderProducts = (category, activeTags) => {
  const grid = document.querySelector("[data-product-grid]");
  if (!grid) {
    return;
  }

  grid.innerHTML = "";
  const filtered = store.products.filter((product) => {
    if (category !== "all" && product.category !== category) {
      return false;
    }
    if (!activeTags.length) {
      return true;
    }
    return product.tags.some((tag) => activeTags.includes(tag));
  });

  filtered.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card reveal";
    card.innerHTML = `
      <span class="tag">${category === "all" ? product.category : category}</span>
      <img src="${getProductImage(product)}" alt="${product.name}" loading="lazy" />
      <h4>${product.name}</h4>
      <p>${product.note}</p>
      <span>${product.price}</span>
      <a href="${getProductLink(product)}">Виж детайли</a>
    `;
    grid.appendChild(card);
  });
};

const setupCategorySwitch = () => {
  const container = document.querySelector("[data-category-switch]");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.dataset.category = "all";
  allButton.textContent = "Всички";
  container.appendChild(allButton);

  store.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.textContent = category;
    container.appendChild(button);
  });

  const buttons = Array.from(container.querySelectorAll("button"));
  const setActive = (button) => {
    buttons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderProducts(button.dataset.category, getActiveTags());
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => setActive(button));
  });

  if (buttons[0]) {
    setActive(buttons[0]);
  }
};

const renderTags = () => {
  const container = document.querySelector("[data-tag-list]");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  store.tags.forEach((tag) => {
    const label = document.createElement("label");
    label.className = "filter-chip";
    label.innerHTML = `
      <input type="checkbox" value="${tag}" />
      <span>${tag}</span>
    `;
    container.appendChild(label);
  });
};

const getActiveTags = () => {
  const inputs = document.querySelectorAll("[data-tag-list] input:checked");
  return Array.from(inputs).map((input) => input.value);
};

const setupTagEvents = () => {
  const container = document.querySelector("[data-tag-list]");
  if (!container) {
    return;
  }

  container.addEventListener("change", () => {
    const activeButton = document.querySelector(
      "[data-category-switch] .active"
    );
    if (activeButton) {
      renderProducts(activeButton.dataset.category, getActiveTags());
    }
  });
};

const renderProductDetail = (product) => {
  const title = document.querySelector("[data-product-title]");
  if (!title) {
    return;
  }

  const price = document.querySelector("[data-product-price]");
  const note = document.querySelector("[data-product-note]");
  const image = document.querySelector("[data-product-image]");
  const category = document.querySelector("[data-product-category]");
  const tags = document.querySelector("[data-product-tags]");
  const gallery = document.querySelector("[data-product-gallery]");

  title.textContent = product.name;
  price.textContent = product.price;
  note.textContent = product.note;
  image.src = getProductImage(product);
  image.alt = product.name;
  category.textContent = product.category;

  if (tags) {
    tags.innerHTML = "";
    product.tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-pill";
      chip.textContent = tag;
      tags.appendChild(chip);
    });
  }

  if (gallery) {
    gallery.innerHTML = "";
    const gallerySources =
      product.gallery && product.gallery.length
        ? product.gallery
        : ["images/gallery-1.svg", "images/gallery-2.svg", "images/gallery-3.svg"];
    gallerySources.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "Детайл";
      gallery.appendChild(img);
    });
  }
};

const bootProductsPage = () => {
  renderTags();
  setupCategorySwitch();
  setupTagEvents();
};

const setupOrderForm = (product) => {
  const button = document.querySelector("[data-order-form-button]");
  const modal = document.querySelector("[data-order-form-modal]");
  const productField = document.querySelector("[data-order-product]");
  if (!button || !modal || !productField) {
    return;
  }
  const closeButton = modal.querySelector("[data-order-form-close]");
  const form = modal.querySelector("[data-order-form]");

  const openModal = () => {
    productField.value = product.name;
    modal.hidden = false;
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  button.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    closeModal();
    form.reset();
  });
};

const bootProductDetailPage = () => {
  const title = document.querySelector("[data-product-title]");
  if (!title) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const product = store.products.find((item) => String(item.id) === String(id));
  const error = document.querySelector("[data-product-error]");

  if (!product) {
    if (error) {
      error.style.display = "block";
    }
    return;
  }

  renderProductDetail(product);
  setupOrderForm(product);
};

const bootCookieBanner = () => {
  const banner = document.querySelector("[data-cookie-banner]");
  if (!banner) {
    return;
  }
  const accepted = localStorage.getItem("lindilove-cookie-accepted");
  if (accepted === "true") {
    banner.remove();
    return;
  }
  const button = banner.querySelector("[data-cookie-accept]");
  if (!button) {
    return;
  }
  button.addEventListener("click", () => {
    localStorage.setItem("lindilove-cookie-accepted", "true");
    banner.remove();
  });
};

const bootNavToggle = () => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", () => {
    menu.classList.toggle("is-open");
  });

  menu.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      menu.classList.remove("is-open");
    }
  });
};

const bootOrderModal = () => {
  const button = document.querySelector("[data-order-button]");
  const modal = document.querySelector("[data-order-modal]");
  if (!button || !modal) {
    return;
  }
  const closeButton = modal.querySelector("[data-order-close]");

  const openModal = () => {
    modal.hidden = false;
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  button.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
};

const boot = async () => {
  bootCookieBanner();
  bootNavToggle();
  bootOrderModal();

  const isProductsPage = Boolean(
    document.querySelector("[data-product-grid]")
  );
  const isProductDetailPage = Boolean(
    document.querySelector("[data-product-title]")
  );

  if (isProductsPage || isProductDetailPage) {
    store = await loadStore();
    bootProductsPage();
    bootProductDetailPage();
  } else {
    loadStore();
  }
};

boot();
