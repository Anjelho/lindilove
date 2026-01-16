const sheetCsvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5Y9SskoVGkOZ80BIAsUOb9gHX4CzPbacMf1_GmfsFZulmKCe30sx24GyhQ8JpCkCfLH5wNHyZAcmV/pub?output=csv";
const storeCacheKey = "lindilove-store-cache";
const storeCacheTtlMs = 10 * 60 * 1000;

const fallbackStore = {
  categories: ["Свещи", "Китки"],
  tags: ["14 Февруари", "Рожден ден", "Кръщене"],
  products: [
    {
      id: 1,
      name: "Свещ - Ванилия и бял чай",
      price: "24 лв.",
      category: "Свещи",
      note: "Създадена за уютни вечери",
      image: "images/candle-vanilla.svg",
      tags: ["14 Февруари"],
      gallery: [],
    },
  ],
};

const normalizeText = (value) => (value || "").trim();

const pickField = (row, keys) => {
  for (const key of keys) {
    const value = normalizeText(row[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

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
      const tags = normalizeText(row.tags || row["тагове"] || row["таг"])
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      const gallery = normalizeText(row.gallery || row["галерия"])
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      return {
        id: Number(row.id) || index + 1,
        name: pickField(row, ["name", "име", "продукт"]),
        price: pickField(row, ["price", "цена"]),
        category: pickField(row, ["category", "категория"]),
        note: pickField(row, ["note", "описание", "description"]),
        image: pickField(row, ["image", "снимка", "photo"]),
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
      <a href="${getProductLink(product)}" aria-label="Виж детайли за ${product.name}">
        <img src="${getProductImage(product)}" alt="${product.name}" loading="lazy" />
      </a>
      <h4>${product.name}</h4>
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
  const imageLink = document.querySelector("[data-product-image-link]");
  const category = document.querySelector("[data-product-category]");
  const tags = document.querySelector("[data-product-tags]");
  const gallery = document.querySelector("[data-product-gallery]");

  title.textContent = product.name;
  price.textContent = product.price;
  note.textContent = product.note;
  category.textContent = product.category;

  const primaryImage = getProductImage(product);
  if (image) {
    image.src = primaryImage;
    image.alt = product.name;
  }
  if (imageLink) {
    imageLink.href = primaryImage;
  }

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
    const fallbackGallery = [
      "images/gallery-1.svg",
      "images/gallery-2.svg",
      "images/gallery-3.svg",
    ];
    const rawSources = [primaryImage].concat(
      product.gallery && product.gallery.length ? product.gallery : fallbackGallery
    );
    const uniqueSources = Array.from(new Set(rawSources.filter(Boolean)));
    let activeIndex = 0;

    const setActiveThumb = (src) => {
      const thumbs = gallery.querySelectorAll("img");
      thumbs.forEach((thumb) => {
        thumb.classList.toggle("is-active", thumb.dataset.src === src);
      });
    };

    const updateNavVisibility = () => {
      const canScroll = gallery.scrollWidth > gallery.clientWidth + 4;
      if (prevButton) {
        prevButton.classList.toggle("is-hidden", !canScroll);
      }
      if (nextButton) {
        nextButton.classList.toggle("is-hidden", !canScroll);
      }
    };

    const selectImage = (index) => {
      const src = uniqueSources[index];
      if (!src) {
        return;
      }
      activeIndex = index;
      if (image) {
        image.src = src;
        image.alt = product.name;
      }
      if (imageLink) {
        imageLink.href = src;
      }
      setActiveThumb(src);
      const thumb = gallery.querySelector(`img[data-index="${index}"]`);
      if (thumb) {
        thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
      updateNavVisibility();
    };

    uniqueSources.forEach((src, index) => {
      const thumb = document.createElement("img");
      thumb.src = src;
      thumb.alt = product.name;
      thumb.dataset.src = src;
      thumb.dataset.index = String(index);
      if (index === 0) {
        thumb.classList.add("is-active");
      }
      thumb.addEventListener("click", () => {
        selectImage(index);
      });
      gallery.appendChild(thumb);
    });

    const prevButton = document.querySelector("[data-gallery-prev]");
    const nextButton = document.querySelector("[data-gallery-next]");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        const nextIndex = (activeIndex - 1 + uniqueSources.length) % uniqueSources.length;
        selectImage(nextIndex);
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        const nextIndex = (activeIndex + 1) % uniqueSources.length;
        selectImage(nextIndex);
      });
    }

    window.addEventListener("resize", updateNavVisibility);

    selectImage(0);
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
  const success = form.querySelector("[data-form-success]");
  const submitButton = form.querySelector('button[type=\"submit\"]');

  const openModal = () => {
    productField.value = product.name;
    if (success) {
      success.hidden = true;
    }
    modal.hidden = false;
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  const setStatus = (message) => {
    if (success) {
      success.textContent = message;
      success.hidden = false;
    }
  };

  button.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton) {
      submitButton.disabled = true;
    }
    try {
      const response = await fetch(form.getAttribute("action") || "send.php", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setStatus("Благодарим ви! Ще се свържем с вас скоро.");
      form.reset();
      setTimeout(closeModal, 1500);
    } catch {
      setStatus("Възникна грешка. Опитайте отново.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
};


const setupImageLightbox = () => {
  const link = document.querySelector("[data-product-image-link]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  if (!link || !lightbox || !lightboxImage) {
    return;
  }
  const closeButton = lightbox.querySelector("[data-lightbox-close]");

  const open = (src, alt) => {
    lightboxImage.src = src;
    lightboxImage.alt = alt;
    lightbox.hidden = false;
  };

  const close = () => {
    lightbox.hidden = true;
  };

  link.addEventListener("click", (event) => {
    event.preventDefault();
    const image = document.querySelector("[data-product-image]");
    open(link.getAttribute("href"), image ? image.alt : "Продукт");
  });

  if (closeButton) {
    closeButton.addEventListener("click", close);
  }

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) {
      close();
    }
  });
};


const setupInfoModal = () => {
  const modal = document.querySelector("[data-order-modal]");
  if (!modal) {
    return;
  }
  const buttons = document.querySelectorAll("[data-order-button]");
  if (!buttons.length) {
    return;
  }
  const closeButton = modal.querySelector("[data-order-close]");

  const open = () => {
    modal.hidden = false;
  };

  const close = () => {
    modal.hidden = true;
  };

  buttons.forEach((button) => {
    button.addEventListener("click", open);
  });

  if (closeButton) {
    closeButton.addEventListener("click", close);
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      close();
    }
  });
};

const setupContactForm = () => {
  const form = document.querySelector("[data-contact-form]");
  if (!form) {
    return;
  }
  const success = form.querySelector("[data-form-success]");
  const submitButton = form.querySelector('button[type=\"submit\"]');

  const setStatus = (message) => {
    if (success) {
      success.textContent = message;
      success.hidden = false;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton) {
      submitButton.disabled = true;
    }
    try {
      const response = await fetch(form.getAttribute("action") || "send.php", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setStatus("Благодарим ви! Ще се свържем с вас скоро.");
      form.reset();
    } catch {
      setStatus("Възникна грешка. Опитайте отново.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
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
  setupImageLightbox();
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


const setupSliderVideoSpeed = () => {
  const video = document.querySelector(".slider-video");
  if (!video) {
    return;
  }
  const fastRate = 1.5;
  const normalRate = 1;
  const fastUntil = 3;

  const updateRate = () => {
    if (video.currentTime < fastUntil) {
      if (video.playbackRate !== fastRate) {
        video.playbackRate = fastRate;
      }
    } else if (video.playbackRate !== normalRate) {
      video.playbackRate = normalRate;
    }
  };

  video.addEventListener("timeupdate", updateRate);
  video.addEventListener("seeked", updateRate);
  video.addEventListener("loadedmetadata", updateRate);
  video.addEventListener("play", updateRate);
};

const bootHomeSlider = () => {
  const slider = document.querySelector("[data-slider]");
  if (!slider) {
    return;
  }
  const slides = Array.from(slider.querySelectorAll(".slide"));
  const dotsContainer = slider.querySelector("[data-slider-dots]");
  const prevButton = slider.querySelector("[data-slider-prev]");
  const nextButton = slider.querySelector("[data-slider-next]");
  let currentIndex = 0;
  let timerId = null;

  const setActive = (index) => {
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
    });
    if (dotsContainer) {
      const dots = Array.from(dotsContainer.children);
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
      });
    }
    currentIndex = index;
  };

  if (dotsContainer) {
    dotsContainer.innerHTML = "";
    slides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.addEventListener("click", () => {
        setActive(index);
        restartTimer();
      });
      dotsContainer.appendChild(dot);
    });
  }

  const goNext = () => {
    const nextIndex = (currentIndex + 1) % slides.length;
    setActive(nextIndex);
  };

  const goPrev = () => {
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    setActive(prevIndex);
  };

  const restartTimer = () => {
    if (timerId) {
      clearInterval(timerId);
    }
    timerId = setInterval(goNext, 6500);
  };

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      goPrev();
      restartTimer();
    });
  }
  if (nextButton) {
    nextButton.addEventListener("click", () => {
      goNext();
      restartTimer();
    });
  }

  setActive(0);
  restartTimer();
};

const boot = async () => {
  bootCookieBanner();
  bootNavToggle();
  bootHomeSlider();
  setupSliderVideoSpeed();
  setupContactForm();
  setupInfoModal();

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
