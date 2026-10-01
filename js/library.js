/* =========================================================
   BA PROJECT
   File: library.js

   Purpose:
   - Load authenticated user's saved papers
   - Search inside saved papers
   - Filter by access type
   - Sort saved papers
   - Remove saved papers
   - Switch BA interface language

   Security Notes:
   - Supabase RLS is the authorization layer.
   - Dynamic text is rendered using textContent.
   - External URLs are restricted to HTTP / HTTPS.
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const languageButton =
    document.querySelector(
        "#languageButton"
    );


const librarySearchInput =
    document.querySelector(
        "#librarySearchInput"
    );


const libraryAccessFilter =
    document.querySelector(
        "#libraryAccessFilter"
    );


const librarySortSelect =
    document.querySelector(
        "#librarySortSelect"
    );


const libraryResultCount =
    document.querySelector(
        "#libraryResultCount"
    );


const libraryStatus =
    document.querySelector(
        "#libraryStatus"
    );


const libraryPapersList =
    document.querySelector(
        "#libraryPapersList"
    );



/* =========================================================
   STATE
========================================================= */

let currentLanguage =
    localStorage.getItem(
        "ba-language"
    ) || "ar";


let currentUser =
    null;


let savedPapers =
    [];


let visiblePapers =
    [];



/* =========================================================
   LANGUAGE
========================================================= */

function changeLanguage(language) {

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";


    document
        .querySelectorAll(
            "[data-ar][data-en]"
        )
        .forEach(
            (element) => {

                element.textContent =
                    element.dataset[
                        safeLanguage
                    ];

            }
        );


    document
        .querySelectorAll(
            "[data-placeholder-ar][data-placeholder-en]"
        )
        .forEach(
            (element) => {

                element.placeholder =
                    safeLanguage === "ar"
                        ? element.dataset.placeholderAr
                        : element.dataset.placeholderEn;

            }
        );


    document.documentElement.lang =
        safeLanguage;


    document.documentElement.dir =
        safeLanguage === "ar"
            ? "rtl"
            : "ltr";


    if (languageButton) {

        languageButton.textContent =
            safeLanguage === "ar"
                ? "EN"
                : "AR";

    }


    document.title =
        safeLanguage === "ar"
            ? "BA | المكتبة العلمية"
            : "BA | Scientific Library";


    currentLanguage =
        safeLanguage;


    localStorage.setItem(
        "ba-language",
        safeLanguage
    );


    applyLibraryFilters();

}



if (languageButton) {

    languageButton.addEventListener(
        "click",
        () => {

            changeLanguage(
                currentLanguage === "ar"
                    ? "en"
                    : "ar"
            );

        }
    );

}


changeLanguage(
    currentLanguage
);



/* =========================================================
   SUPABASE CHECK
========================================================= */

function ensureSupabaseClient() {

    if (!window.baSupabase) {

        throw new Error(
            "BA: Supabase client is not available."
        );

    }

}



/* =========================================================
   AUTHENTICATED USER
========================================================= */

async function loadCurrentUser() {

    ensureSupabaseClient();


    const {
        data,
        error
    } =
        await window.baSupabase
            .auth
            .getUser();


    if (
        error ||
        !data?.user
    ) {

        if (error) {

            console.error(
                "BA: Unable to verify library session."
            );

        }


        window.location.replace(
            "./login.html"
        );


        return false;

    }


    currentUser =
        data.user;


    return true;

}



/* =========================================================
   LOAD SAVED PAPERS
========================================================= */

async function loadSavedPapers() {

    if (!currentUser) {

        return;

    }


    setLibraryStatus(
        "جارٍ تحميل مكتبتك العلمية...",
        "Loading your scientific library..."
    );


    const {
        data,
        error
    } =
        await window.baSupabase
            .from(
                "saved_papers"
            )
            .select(`
                id,
                openalex_id,
                title,
                doi,
                publication_year,
                source_name,
                authors,
                is_open_access,
                cited_by_count,
                source_url,
                saved_at
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "saved_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "BA: Unable to load scientific library."
        );


        setLibraryStatus(
            "تعذر تحميل مكتبتك العلمية.",
            "Unable to load your scientific library."
        );


        return;

    }


    savedPapers =
        Array.isArray(data)
            ? data
            : [];


    setLibraryStatus(
        "",
        ""
    );


    applyLibraryFilters();

}



/* =========================================================
   STATUS
========================================================= */

function setLibraryStatus(
    arabicMessage,
    englishMessage
) {

    if (!libraryStatus) {

        return;

    }


    libraryStatus.textContent =
        currentLanguage === "ar"
            ? arabicMessage
            : englishMessage;

}



/* =========================================================
   FILTER + SEARCH + SORT
========================================================= */

function applyLibraryFilters() {

    let papers =
        [
            ...savedPapers
        ];


    /* =========================
       SEARCH
    ========================= */

    const searchTerm =
        librarySearchInput
            ?.value
            ?.trim()
            ?.toLowerCase()
        || "";


    if (searchTerm) {

        papers =
            papers.filter(
                (paper) => {

                    const title =
                        typeof paper.title === "string"
                            ? paper.title.toLowerCase()
                            : "";


                    const source =
                        typeof paper.source_name === "string"
                            ? paper.source_name.toLowerCase()
                            : "";


                    const authors =
                        Array.isArray(
                            paper.authors
                        )
                            ? paper.authors
                                .filter(
                                    (author) =>
                                        typeof author === "string"
                                )
                                .join(" ")
                                .toLowerCase()
                            : "";


                    return (
                        title.includes(
                            searchTerm
                        ) ||
                        source.includes(
                            searchTerm
                        ) ||
                        authors.includes(
                            searchTerm
                        )
                    );

                }
            );

    }



    /* =========================
       ACCESS FILTER
    ========================= */

    const accessFilter =
        libraryAccessFilter
            ?.value
        || "all";


    if (
        accessFilter ===
        "open"
    ) {

        papers =
            papers.filter(
                (paper) =>
                    paper.is_open_access === true
            );

    }


    if (
        accessFilter ===
        "restricted"
    ) {

        papers =
            papers.filter(
                (paper) =>
                    paper.is_open_access !== true
            );

    }



    /* =========================
       SORT
    ========================= */

    const sortValue =
        librarySortSelect
            ?.value
        || "saved-desc";


    papers.sort(
        (a, b) => {

            switch (
                sortValue
            ) {

                case "saved-asc":

                    return (
                        getTimeValue(
                            a.saved_at
                        ) -
                        getTimeValue(
                            b.saved_at
                        )
                    );


                case "citations-desc":

                    return (
                        getNumberValue(
                            b.cited_by_count
                        ) -
                        getNumberValue(
                            a.cited_by_count
                        )
                    );


                case "year-desc":

                    return (
                        getNumberValue(
                            b.publication_year
                        ) -
                        getNumberValue(
                            a.publication_year
                        )
                    );


                case "year-asc":

                    return (
                        getNumberValue(
                            a.publication_year
                        ) -
                        getNumberValue(
                            b.publication_year
                        )
                    );


                case "saved-desc":
                default:

                    return (
                        getTimeValue(
                            b.saved_at
                        ) -
                        getTimeValue(
                            a.saved_at
                        )
                    );

            }

        }
    );


    visiblePapers =
        papers;


    renderLibrary();

}



/* =========================================================
   RENDER LIBRARY
========================================================= */

function renderLibrary() {

    if (!libraryPapersList) {

        return;

    }


    libraryPapersList.replaceChildren();


    renderResultCount();


    if (
        savedPapers.length === 0
    ) {

        setLibraryStatus(
            "لم تحفظ أي أبحاث حتى الآن.",
            "You have not saved any research yet."
        );


        return;

    }


    if (
        visiblePapers.length === 0
    ) {

        setLibraryStatus(
            "لا توجد نتائج تطابق البحث أو التصفية الحالية.",
            "No saved papers match your current search or filters."
        );


        return;

    }


    setLibraryStatus(
        "",
        ""
    );


    visiblePapers.forEach(
        (paper) => {

            const card =
                createLibraryPaperCard(
                    paper
                );


            libraryPapersList.appendChild(
                card
            );

        }
    );

}



/* =========================================================
   RESULT COUNT
========================================================= */

function renderResultCount() {

    if (!libraryResultCount) {

        return;

    }


    const visibleCount =
        visiblePapers.length;


    const totalCount =
        savedPapers.length;


    if (
        currentLanguage === "ar"
    ) {

        libraryResultCount.textContent =
            `عرض ${visibleCount} من ${totalCount} بحث محفوظ`;

    }

    else {

        libraryResultCount.textContent =
            `Showing ${visibleCount} of ${totalCount} saved papers`;

    }

}



/* =========================================================
   CREATE PAPER CARD
========================================================= */

function createLibraryPaperCard(
    paper
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "library-paper-card";



    /* =========================
       TOP
    ========================= */

    const top =
        document.createElement(
            "div"
        );


    top.className =
        "library-paper-top";


    const type =
        document.createElement(
            "span"
        );


    type.className =
        "library-paper-type";


    type.textContent =
        currentLanguage === "ar"
            ? "ورقة علمية"
            : "Scientific Paper";


    const year =
        document.createElement(
            "span"
        );


    year.className =
        "library-paper-year";


    year.textContent =
        paper.publication_year ||
        "-";


    top.append(
        type,
        year
    );



    /* =========================
       TITLE
    ========================= */

    const title =
        document.createElement(
            "h2"
        );


    title.textContent =
        paper.title ||
        (
            currentLanguage === "ar"
                ? "بدون عنوان"
                : "Untitled"
        );



    /* =========================
       AUTHORS
    ========================= */

    const authors =
        document.createElement(
            "p"
        );


    authors.className =
        "library-paper-authors";


    authors.textContent =
        getAuthorsText(
            paper.authors
        );



    /* =========================
       SOURCE
    ========================= */

    const source =
        document.createElement(
            "p"
        );


    source.className =
        "library-paper-source";


    source.textContent =
        paper.source_name ||
        (
            currentLanguage === "ar"
                ? "المصدر غير متوفر"
                : "Source unavailable"
        );



    /* =========================
       META
    ========================= */

    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "library-paper-meta";


    const citations =
        document.createElement(
            "span"
        );


    citations.textContent =
        currentLanguage === "ar"
            ? `${getNumberValue(
                paper.cited_by_count
            )} استشهاد`
            : `${getNumberValue(
                paper.cited_by_count
            )} citations`;


    const access =
        document.createElement(
            "span"
        );


    access.textContent =
        paper.is_open_access
            ? (
                currentLanguage === "ar"
                    ? "وصول مفتوح"
                    : "Open Access"
            )
            : (
                currentLanguage === "ar"
                    ? "وصول محدود"
                    : "Restricted"
            );


    meta.append(
        citations,
        access
    );



    /* =========================
       ACTIONS
    ========================= */

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "library-paper-actions";


    /* Details */

    const detailsLink =
        document.createElement(
            "a"
        );


    detailsLink.className =
        "library-paper-details";


    detailsLink.textContent =
        currentLanguage === "ar"
            ? "عرض التفاصيل"
            : "View Details";


    if (
        isValidOpenAlexId(
            paper.openalex_id
        )
    ) {

        detailsLink.href =
            `./paper.html?id=${encodeURIComponent(
                paper.openalex_id.trim()
            )}`;

    }

    else {

        detailsLink.setAttribute(
            "aria-disabled",
            "true"
        );

    }



    /* Source */

    const sourceLink =
        document.createElement(
            "a"
        );


    sourceLink.className =
        "library-paper-source-link";


    sourceLink.textContent =
        currentLanguage === "ar"
            ? "فتح المصدر"
            : "Open Source";


    const safeSourceUrl =
        getSafeUrl(
            paper.source_url
        );


    if (safeSourceUrl) {

        sourceLink.href =
            safeSourceUrl;


        sourceLink.target =
            "_blank";


        sourceLink.rel =
            "noopener noreferrer";

    }

    else {

        sourceLink.setAttribute(
            "aria-disabled",
            "true"
        );

    }



    /* Delete */

    const removeButton =
        document.createElement(
            "button"
        );


    removeButton.type =
        "button";


    removeButton.className =
        "library-paper-remove";


    removeButton.textContent =
        currentLanguage === "ar"
            ? "إزالة"
            : "Remove";


    removeButton.addEventListener(
        "click",
        async () => {

            await removeSavedPaper(
                paper.id
            );

        }
    );


    actions.append(
        detailsLink,
        sourceLink,
        removeButton
    );


    card.append(
        top,
        title,
        authors,
        source,
        meta,
        actions
    );


    return card;

}



/* =========================================================
   REMOVE SAVED PAPER
========================================================= */

async function removeSavedPaper(
    savedPaperId
) {

    if (
        !savedPaperId ||
        !currentUser
    ) {

        return;

    }


    const confirmed =
        window.confirm(
            currentLanguage === "ar"
                ? "هل تريد إزالة هذه الورقة من مكتبتك؟"
                : "Remove this paper from your library?"
        );


    if (!confirmed) {

        return;

    }


    const {
        error
    } =
        await window.baSupabase
            .from(
                "saved_papers"
            )
            .delete()
            .eq(
                "id",
                savedPaperId
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "BA: Unable to remove saved paper."
        );


        alert(
            currentLanguage === "ar"
                ? "تعذر إزالة الورقة."
                : "Unable to remove the paper."
        );


        return;

    }


    savedPapers =
        savedPapers.filter(
            (paper) =>
                paper.id !==
                savedPaperId
        );


    applyLibraryFilters();

}



/* =========================================================
   HELPERS
========================================================= */

function getAuthorsText(
    authors
) {

    if (
        !Array.isArray(
            authors
        ) ||
        authors.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلفون غير متوفرين"
            : "Authors unavailable";

    }


    const safeAuthors =
        authors
            .filter(
                (author) =>
                    typeof author ===
                        "string" &&
                    author.trim()
            )
            .map(
                (author) =>
                    author.trim()
            );


    if (
        safeAuthors.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلفون غير متوفرين"
            : "Authors unavailable";

    }


    const visible =
        safeAuthors.slice(
            0,
            5
        );


    let text =
        visible.join(
            ", "
        );


    if (
        safeAuthors.length > 5
    ) {

        text +=
            ", et al.";

    }


    return text;

}


function isValidOpenAlexId(
    value
) {

    return (
        typeof value === "string" &&
        /^W\d+$/i.test(
            value.trim()
        )
    );

}


function getSafeUrl(
    value
) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        return null;

    }


    try {

        const url =
            new URL(
                value.trim()
            );


        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {

            return null;

        }


        return url.href;

    }

    catch {

        return null;

    }

}


function getNumberValue(
    value
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


function getTimeValue(
    value
) {

    if (!value) {

        return 0;

    }


    const time =
        new Date(
            value
        )
            .getTime();


    return Number.isFinite(
        time
    )
        ? time
        : 0;

}



/* =========================================================
   CONTROLS
========================================================= */

if (librarySearchInput) {

    librarySearchInput.addEventListener(
        "input",
        () => {

            applyLibraryFilters();

        }
    );

}


if (libraryAccessFilter) {

    libraryAccessFilter.addEventListener(
        "change",
        () => {

            applyLibraryFilters();

        }
    );

}


if (librarySortSelect) {

    librarySortSelect.addEventListener(
        "change",
        () => {

            applyLibraryFilters();

        }
    );

}



/* =========================================================
   INITIALIZE
========================================================= */

async function initializeLibrary() {

    try {

        const authenticated =
            await loadCurrentUser();


        if (!authenticated) {

            return;

        }


        await loadSavedPapers();

    }

    catch (error) {

        console.error(
            "BA: Unexpected scientific library error.",
            error
        );


        setLibraryStatus(
            "حدث خطأ أثناء تحميل المكتبة.",
            "An error occurred while loading the library."
        );

    }

}



/* =========================================================
   START
========================================================= */

initializeLibrary();