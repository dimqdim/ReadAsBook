const textArea = document.querySelector(".text-col");
const contentArea = document.querySelector(".content");
const pageNumberArea = document.querySelector("#page-number");

const PageProportion = 4 / 3;

let readerOptions = {
  layout: "page", // отображение страницы (page, book, paper)
  isMaintainProportions: true, // необходимость соблюдать пропорции страницы
  columnGap: 20
};

let totalWidth;
let totalPages;
let totalColumns;
let pageWidth;
let pageHeight;
let columnGap;
let columnWidth;

window.onresize = function () {
  // setTimeout(function () {
  updateLayout();
  // }, 500);
};

window.onload = function () {
  updateLayout();
};

textArea.onscroll = function () {
  showPageNumber();
};

const proportionBtn = document.querySelector("#btn-proportion");
proportionBtn.onclick = function () {
  readerOptions.isMaintainProportions = !readerOptions.isMaintainProportions;
  updateLayout();
};

const nextBtn = document.querySelector("#btn-next");
nextBtn.onclick = function () {
  nextprevClick(1);
};

const prevBtn = document.querySelector("#btn-prev");
prevBtn.onclick = function () {
  nextprevClick(-1);
};

const firstBtn = document.querySelector("#btn-first");
firstBtn.onclick = function () {
  textArea.scrollTo(0, 0);
  pageNumberArea.innerText = 1 + " / " + totalPages;
};

const lastBtn = document.querySelector("#btn-last");
lastBtn.onclick = function () {
  textArea.scrollTo(textArea.scrollWidth, 0);
  pageNumberArea.innerText = totalPages + " / " + totalPages;
};

const curBtn = document.querySelector("#btn-cur");
curBtn.onclick = function () {
  nextprevClick(0);
};

const pageBtn = document.querySelector("#btn-page");
pageBtn.onclick = function () {
  readerOptions.layout = "page";
  updateLayout();
  nextprevClick(0);
};

const bookBtn = document.querySelector("#btn-book");
bookBtn.onclick = function () {
  readerOptions.layout = "book";
  updateLayout();
  nextprevClick(0);
};

function hyphenate(element) {
  let all = "[абвгдеёжзийклмнопрстуфхцчшщъыьэюя]",
    glas = "[аеёиоуыэюя]",
    sogl = "[бвгджзклмнпрстфхцчшщ]",
    zn = "[йъь]",
    shy = "\xAD",
    re = [];

  re[1] = new RegExp("(" + zn + ")(" + all + all + ")", "ig");
  re[2] = new RegExp("(" + glas + ")(" + glas + all + ")", "ig");
  re[3] = new RegExp("(" + glas + sogl + ")(" + sogl + glas + ")", "ig");
  re[4] = new RegExp("(" + sogl + glas + ")(" + sogl + glas + ")", "ig");
  re[5] = new RegExp("(" + glas + sogl + ")(" + sogl + sogl + glas + ")", "ig");
  re[6] = new RegExp(
    "(" + glas + sogl + sogl + ")(" + sogl + sogl + glas + ")",
    "ig"
  );

  let elements = element.querySelectorAll("p");
  let num = 0;
  elements.forEach((el) => {
    if (el.textContent != null && el.textContent.length > 0) {
      let text = el.textContent;
      for (let i = 1; i < 7; ++i) {
        text = text.replace(re[i], "$1" + shy + "$2");
      }
      if (num == 0) {
        // console.log(el.innerHTML);
        el.textContent = "[RU] " + text;
      }
      num = num + 1;
    }
  });
}

function nextprevClick(dir) {
  let num = getCurrentPage();
  let newNum = num + dir;
  if (newNum < 0) newNum = 0;
  if (newNum > totalPages) newNum = totalPages - 1;
  textArea.scrollTo(newNum * (pageWidth + columnGap), 0);
}

function updateLayoutTimeout() {
  setTimeout(function () {
    updateLayout();
  }, 200);
}

function setActualSize() {
  let parWidth = contentArea.clientWidth - 16;
  let parHeight = contentArea.clientHeight - 16;

  let width;
  let height;
  let pageProportion =
    readerOptions.layout == "page" ? PageProportion : 1 / PageProportion;

  if (readerOptions.isMaintainProportions) {
    if (parHeight / parWidth > pageProportion) {
      width = parWidth;
      height = Math.ceil(parWidth * pageProportion);
    } else {
      width = Math.ceil(parHeight / pageProportion);
      height = parHeight;
    }
  } else {
    width = parWidth;
    height = parHeight;
  }
  columnGap = readerOptions.columnGap;
  pageWidth = width;
  pageHeight = height;
  if (pageWidth % 2 != 0) {
    pageWidth += 1;
  }

  totalWidth = textArea.scrollWidth;
  columnWidth =
    readerOptions.layout == "page"
      ? pageWidth
      : Math.floor((pageWidth - columnGap) / 2);
  totalColumns = (totalWidth + columnGap) / (columnWidth + columnGap);
  totalPages = readerOptions.layout == "page" ? totalColumns : totalColumns / 2;

  textArea.style.width = pageWidth + "px";
  textArea.style.height = pageHeight + "px";
  textArea.style.columnGap = columnGap + "px";
  textArea.style.columnWidth = columnWidth + "px";

  console.log(
    "totalWidth: " +
      totalWidth +
      ",columnWidth: " +
      columnWidth +
      ",pageWidth: " +
      pageWidth +
      ",totalColumns: " +
      totalColumns.toFixed(2) +
      ", delta: " +
      (totalWidth - totalColumns * (columnWidth + columnGap)).toFixed(2)
  );
}

function updateLayout() {
  let lastPage = document.querySelector("#last-page");
  lastPage.style.display = "none";
  lastPage.style.minHeight = 0;

  setActualSize();

  setActualSize();

  if (readerOptions.layout == "book" && totalColumns % 2 != 0) {
    lastPage.style.minHeight = textArea.clientHeight + "px";
    lastPage.style.maxWidth = columnWidth;
    lastPage.style.display = "block";
    console.log(
      "totalColumns: " +
        totalColumns +
        ", textArea.clientHeight: " +
        textArea.clientHeight
    );
  }

  setActualSize();

  showPageNumber();
  proportionBtn.innerHTML = !readerOptions.isMaintainProportions
    ? "3 x 4"
    : "Free";
}

function getCurrentPage() {
  return Math.floor(Math.round(textArea.scrollLeft) / (pageWidth + columnGap));
}

function showPageNumber() {
  let num = getCurrentPage();
  let prc = (textArea.scrollLeft * 100) / totalWidth;
  pageNumberArea.innerText =
    num +
    1 +
    " / " +
    totalPages.toFixed(0) +
    " (" +
    prc.toFixed(0) +
    "%) [" +
    textArea.scrollLeft.toFixed(2) +
    "/" +
    totalWidth.toFixed(2) +
    "] {" +
    (textArea.scrollWidth - textArea.scrollLeft).toFixed(2) +
    "/" +
    pageWidth +
    "}";
  // "} " +
  // totalColumns.toFixed(2) +
  // " " +
  // textArea.style.columnWidth +
  // ".";
}

// hyphenate(document);

// updateLayout();
