/* =========================================================
   BA PROJECT
   File: research.js
   Version: BA Search v0.2

   Purpose:
   Searches multiple scientific sources through a Supabase
   Edge Function, then renders a unified, deduplicated and
   ranked result set.

   Current source aggregation:
   - OpenAlex
   - Crossref
   - Europe PMC

   Ranking modes:
   - BA Top
   - Most Relevant
   - Most Cited
   - Newest
   - Open Access

   Reliability:
   - If the Edge Function is not deployed yet, BA falls back
     to direct OpenAlex search so public search still works.

   Security:
   - No secret provider keys belong in this browser file.
   - API content is rendered with textContent.
========================================================= */


/* =========================
   CONFIGURATION
========================= */

const FALLBACK_OPENALEX_API_URL =
    "https://api.openalex.org/works";

const INITIAL_VISIBLE_RESULTS =
    20;

const RESULTS_INCREMENT =
    20;


/* =========================
   ELEMENTS
========================= */

const languageButton =
    document.querySelector("#languageButton");

const searchForm =
    document.querySelector("#researchSearchForm");

const searchInput =
    document.querySelector("#researchSearchInput");

const searchButton =
    document.querySelector("#researchSearchButton");

const statusMessage =
    document.querySelector("#researchStatusMessage");

const resultsContainer =
    document.querySelector("#researchResults");

const resultsCount =
    document.querySelector("#researchResultsCount");

const loadMoreContainer =
    document.querySelector("#researchLoadMoreContainer");

const loadMoreButton =
    document.querySelector("#researchLoadMoreButton");

const sortSelect =
    document.querySelector("#researchSort");


/* =========================
   STATE
========================= */

let currentLanguage =
    localStorage.getItem("ba-language") || "ar";

let currentQuery =
    "";

let isLoading =
    false;

let allResults =
    [];

let visibleResults =
    INITIAL_VISIBLE_RESULTS;

let currentSort =
    "top";

let activeSearchMode =
    "multi-source";


/* =========================
   LANGUAGE
========================= */

function changeLanguage(language) {

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";

    document
        .querySelectorAll("[data-ar][data-en]")
        .forEach((element) => {

            element.textContent =
                element.dataset[safeLanguage];

        });

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
            ? "BA | البحث العلمي"
            : "BA | Research";

    currentLanguage =
        safeLanguage;

    localStorage.setItem(
        "ba-language",
        safeLanguage
    );

    renderResults();
    renderResultsCount();

    if (isLoading) {

        setStatus(
            "جارٍ البحث ودمج النتائج من المصادر العلمية...",
            "Searching and merging results from scientific sources..."
        );

    }

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

changeLanguage(currentLanguage);


/* =========================
   STATUS
========================= */

function setStatus(
    arabicMessage,
    englishMessage
) {

    if (!statusMessage) {
        return;
    }

    statusMessage.textContent =
        currentLanguage === "ar"
            ? arabicMessage
            : englishMessage;

}


/* =========================
   SEARCH
========================= */

async function searchResearch(query) {

    if (
        isLoading ||
        !query
    ) {
        return;
    }

    isLoading = true;
    searchButton.disabled = true;

    if (loadMoreButton) {
        loadMoreButton.disabled = true;
    }

    visibleResults =
        INITIAL_VISIBLE_RESULTS;

    setStatus(
        "جارٍ البحث ودمج النتائج من المصادر العلمية...",
        "Searching and merging results from scientific sources..."
    );

    try {

        const multiSourceData =
            await searchThroughEdgeFunction(
                query
            );

        allResults =
            Array.isArray(
                multiSourceData?.results
            )
                ? multiSourceData.results
                : [];

        activeSearchMode =
    multiSourceData?.searchMode ||
    "multi-source";

        if (
            allResults.length === 0
        ) {

            setStatus(
                "لم يتم العثور على نتائج لهذا البحث.",
                "No research results were found for this search."
            );

        } else {

            if (
    activeSearchMode ===
        "hybrid"
) {

    const coverage =
        Number(
            multiSourceData
                ?.semanticMemoryCoverage
        );


    const coveragePercent =
        Number.isFinite(
            coverage
        )
            ? Math.round(
                coverage *
                100
            )
            : null;


    setStatus(
        coveragePercent !== null

            ? `تم تشغيل بحث BA الهجين: ترتيب علمي + بحث دلالي. تغطية الذاكرة الدلالية الحالية ${coveragePercent}%.`

            : "تم تشغيل بحث BA الهجين: ترتيب علمي + بحث دلالي.",

        coveragePercent !== null

            ? `BA Hybrid Search is active: scientific ranking + semantic search. Current semantic-memory coverage: ${coveragePercent}%.`

            : "BA Hybrid Search is active: scientific ranking + semantic search."
    );

} else {

    const sourceCount =
        Array.isArray(
            multiSourceData.sources
        )
            ? multiSourceData.sources.filter(
                (source) =>
                    source?.ok
              ).length
            : 0;


    setStatus(
        `تم دمج النتائج من ${sourceCount} مصادر علمية وإزالة التكرارات.`,
        `Results were merged from ${sourceCount} scientific sources and deduplicated.`
    );

}

        }

    }

        catch (error) {

        // Never bypass BA Search Rate Limiting
        // by switching to the direct OpenAlex fallback.
        if (
            error instanceof Error &&
            error.message ===
                "تم الوصول إلى الحد المؤقت لطلبات البحث. يرجى المحاولة بعد قليل."
        ) {

            setStatus(
                "تم الوصول إلى الحد المؤقت للبحث. يرجى المحاولة بعد قليل.",
                "Search limit reached. Please try again shortly."
            );

            return;

        }

        // Preserve OpenAlex fallback for other search failures.
        console.warn(
            "BA: Multi-source search unavailable; falling back to OpenAlex.",
            error
        );

        const fallbackResults =
            await searchOpenAlexFallback(
                query
            );

        allResults =
            fallbackResults;

        activeSearchMode =
            "openalex-fallback";

        if (
            allResults.length === 0
        ) {

            setStatus(
                "لم يتم العثور على نتائج لهذا البحث.",
                "No research results were found for this search."
            );

        } else {

            setStatus(
                "يعمل البحث حاليًا عبر OpenAlex فقط. فعّل Edge Function لتشغيل البحث متعدد المصادر.",
                "Search is currently using OpenAlex only. Deploy the Edge Function to enable multi-source search."
            );

        }

    }

    finally {

        isLoading = false;
        searchButton.disabled = false;

        if (loadMoreButton) {
            loadMoreButton.disabled = false;
        }

        renderResults();
        renderResultsCount();
        updateLoadMoreVisibility();

    }

}


/* =========================
   EDGE FUNCTION
========================= */

async function searchThroughEdgeFunction(
    query
) {

    if (
        !window.baSupabase
    ) {

        throw new Error(
            "Supabase client is not available."
        );

    }


    /* =========================
       PRIMARY: BA HYBRID SEARCH
    ========================= */

    const hybridAttempt =
        await window.baSupabase
            .functions
            .invoke(
                "hybrid-search",
                {
                    body: {
                        query
                    }
                }
            );


    if (
        !hybridAttempt.error &&
        hybridAttempt.data &&
        Array.isArray(
            hybridAttempt.data.results
        )
    ) {

        const normalizedResults =
            hybridAttempt.data.results.map(
                normalizeHybridResult
            );

        return {
            ...hybridAttempt.data,

            results:
                normalizedResults,

            searchMode:
                "hybrid"
        };

    }

        // Do not retry when BA Search Rate Limit is reached.
    // Hybrid Search forwards the HTTP 429 from research-search.

    if (
        hybridAttempt.error?.context?.status === 429
    ) {

        throw new Error(
            "تم الوصول إلى الحد المؤقت لطلبات البحث. يرجى المحاولة بعد قليل."
        );

    }

    console.warn(
        "BA: Hybrid search unavailable; falling back to research-search.",
        hybridAttempt.error
    );


    /* =========================
       SECONDARY: MULTI SOURCE
    ========================= */

    const researchAttempt =
        await window.baSupabase
            .functions
            .invoke(
                "research-search",
                {
                    body: {
                        query
                    }
                }
            );


    if (
        researchAttempt.error
    ) {

        throw researchAttempt.error;

    }


    if (
        !researchAttempt.data ||
        !Array.isArray(
            researchAttempt.data.results
        )
    ) {

        throw new Error(
            "Invalid research-search response."
        );

    }


    return {
        ...researchAttempt.data,

        searchMode:
            "multi-source"
    };

}


function normalizeHybridResult(
    result
) {

    const hybridScore =
        Number(
            result?.hybridScore
        );

    const lexicalScore =
        Number(
            result?.lexicalBaScore
        );

    const originalScore =
        Number(
            result?.baScore
        );


    const finalScore =
        Number.isFinite(
            hybridScore
        )
            ? hybridScore

            : (
                Number.isFinite(
                    lexicalScore
                )
                    ? lexicalScore

                    : (
                        Number.isFinite(
                            originalScore
                        )
                            ? originalScore
                            : 0
                    )
            );


    const semanticSimilarity =
        Number(
            result?.semanticSimilarity
        );


    return {
        ...result,

        baScore:
            finalScore,

        hybridScore:
            Number.isFinite(
                hybridScore
            )
                ? hybridScore
                : null,

        lexicalBaScore:
            Number.isFinite(
                lexicalScore
            )
                ? lexicalScore
                : null,

        semanticSimilarity:
            Number.isFinite(
                semanticSimilarity
            )
                ? semanticSimilarity
                : null
    };

}


/* =========================
   OPENALEX FALLBACK
========================= */

async function searchOpenAlexFallback(
    query
) {

    const url =
        new URL(
            FALLBACK_OPENALEX_API_URL
        );

    url.searchParams.set(
        "search",
        query
    );

    url.searchParams.set(
        "per-page",
        "50"
    );

    url.searchParams.set(
        "select",
        [
            "id",
            "doi",
            "title",
            "display_name",
            "publication_year",
            "authorships",
            "primary_location",
            "open_access",
            "cited_by_count"
        ].join(",")
    );

    const response =
        await fetch(
            url.toString(),
            {
                headers: {
                    Accept:
                        "application/json"
                }
            }
        );

    if (!response.ok) {

        throw new Error(
            `OpenAlex request failed: ${response.status}`
        );

    }

    const data =
        await response.json();

    const rawResults =
        Array.isArray(data.results)
            ? data.results
            : [];

    const normalized =
        rawResults.map(
            (work, index) =>
                normalizeFallbackOpenAlex(
                    work,
                    index,
                    rawResults.length
                )
        );

    return scoreFallbackResults(
        normalized,
        query
    );

}


/* =========================
   FALLBACK NORMALIZATION
========================= */

function normalizeFallbackOpenAlex(
    work,
    index,
    count
) {

    const authors =
        Array.isArray(work.authorships)
            ? work.authorships
                .map(
                    item =>
                        item
                            ?.author
                            ?.display_name
                )
                .filter(Boolean)
            : [];

    return {
        key:
            work.doi ||
            work.id ||
            `openalex-${index}`,

        openAlexId:
            getOpenAlexWorkId(
                work.id
            ),

        doi:
            normalizeDoi(
                work.doi
            ),

        title:
            work.display_name ||
            work.title ||
            "",

        authors,

        year:
            Number(
                work.publication_year
            ) || null,

        sourceName:
            work
                ?.primary_location
                ?.source
                ?.display_name
            || "",

        citedByCount:
            Number(
                work.cited_by_count
            ) || 0,

        isOpenAccess:
            Boolean(
                work
                    ?.open_access
                    ?.is_oa
            ),

        url:
            getSafeUrl(
                work.doi
            ) ||
            getSafeUrl(
                work
                    ?.primary_location
                    ?.landing_page_url
            ) ||
            getSafeUrl(
                work
                    ?.primary_location
                    ?.pdf_url
            ),

        sources:
            [
                "OpenAlex"
            ],

        retrievalScore:
            count > 1
                ? 1 -
                    (
                        index /
                        (count - 1)
                    )
                : 1,

        relevanceScore:
            0,

        citationScore:
            0,

        recencyScore:
            0,

        metadataScore:
            0,

        agreementScore:
            0,

        baScore:
            0
    };

}


/* =========================
   FALLBACK SCORING
========================= */

function scoreFallbackResults(
    results,
    query
) {

    const maxCitations =
        Math.max(
            1,
            ...results.map(
                item =>
                    Number(
                        item.citedByCount
                    ) || 0
            )
        );

    const currentYear =
        new Date()
            .getFullYear();

    results.forEach(
        (item) => {

            const lexical =
                calculateLexicalRelevance(
                    query,
                    [
                        item.title,
                        item.sourceName,
                        item.authors
                            ?.join(" ")
                    ]
                        .filter(Boolean)
                        .join(" ")
                );

            item.relevanceScore =
                clamp01(
                    (
                        item.retrievalScore *
                        0.75
                    ) +
                    (
                        lexical *
                        0.25
                    )
                );

            item.citationScore =
                Math.log1p(
                    item.citedByCount || 0
                ) /
                Math.log1p(
                    maxCitations
                );

            const age =
                item.year
                    ? Math.max(
                        0,
                        currentYear -
                        item.year
                    )
                    : 15;

            item.recencyScore =
                clamp01(
                    1 -
                    (
                        age /
                        15
                    )
                );

            item.metadataScore =
                calculateMetadataScore(
                    item
                );

            item.agreementScore =
                0;

            item.baScore =
                Math.round(
                    (
                        item.relevanceScore *
                        45
                    ) +
                    (
                        item.citationScore *
                        20
                    ) +
                    (
                        item.recencyScore *
                        15
                    ) +
                    (
                        (
                            item.isOpenAccess
                                ? 1
                                : 0
                        ) *
                        5
                    ) +
                    (
                        item.metadataScore *
                        5
                    )
                );

        }
    );

    return results;

}


/* =========================
   SORTING
========================= */

function getSortedResults() {

    const results =
        [...allResults];

    switch (
        currentSort
    ) {

        case "relevance":

            results.sort(
                (a, b) =>
                    (
                        b.relevanceScore || 0
                    ) -
                    (
                        a.relevanceScore || 0
                    )
            );

            break;

        case "cited":

            results.sort(
                (a, b) =>
                    (
                        b.citedByCount || 0
                    ) -
                    (
                        a.citedByCount || 0
                    )
            );

            break;

        case "newest":

            results.sort(
                (a, b) =>
                    (
                        b.year || 0
                    ) -
                    (
                        a.year || 0
                    )
            );

            break;

        case "open-access":

            results.sort(
                (a, b) => {

                    const oaDifference =
                        Number(
                            Boolean(
                                b.isOpenAccess
                            )
                        ) -
                        Number(
                            Boolean(
                                a.isOpenAccess
                            )
                        );

                    if (
                        oaDifference !== 0
                    ) {

                        return oaDifference;

                    }

                    return (
                        b.baScore || 0
                    ) -
                    (
                        a.baScore || 0
                    );

                }
            );

            break;

        case "top":
default:

    results.sort(
        (a, b) =>
            (
                b.hybridScore ??
                b.baScore ??
                0
            )
            -
            (
                a.hybridScore ??
                a.baScore ??
                0
            )
    );

    break;

    }

    return results;

}

if (sortSelect) {

    sortSelect.addEventListener(
        "change",
        () => {

            currentSort =
                sortSelect.value;

            visibleResults =
                INITIAL_VISIBLE_RESULTS;

            renderResults();
            updateLoadMoreVisibility();

        }
    );

}


/* =========================
   RENDER RESULTS
========================= */

function renderResults() {

    if (!resultsContainer) {
        return;
    }

    resultsContainer
        .replaceChildren();

    const sortedResults =
        getSortedResults();

    const visible =
        sortedResults.slice(
            0,
            visibleResults
        );

    visible.forEach(
        (result, index) => {

            resultsContainer
                .appendChild(
                    createResearchResultCard(
                        result,
                        index
                    )
                );

        }
    );

}


/* =========================
   RESULT CARD
========================= */

function createResearchResultCard(
    result,
    index
) {

    const article =
        document.createElement(
            "article"
        );

    article.className =
        "research-result-card";


    /* ---------- TOP ---------- */

    const top =
        document.createElement(
            "div"
        );

    top.className =
        "research-result-top";

    const topLeft =
        document.createElement(
            "div"
        );

    topLeft.className =
        "research-result-top-left";

    const type =
        document.createElement(
            "span"
        );

    type.className =
        "research-result-type";

    type.textContent =
        currentSort === "top" &&
        index < 3
            ? (
                currentLanguage === "ar"
                    ? `BA Top ${index + 1}`
                    : `BA Top ${index + 1}`
            )
            : "Paper";

    topLeft.appendChild(
        type
    );

    const score =
        document.createElement(
            "span"
        );

    score.className =
        "research-result-score";

    const displayedScore =
    result.hybridScore ??
    result.baScore ??
    0;


score.textContent =
    currentLanguage === "ar"
        ? `BA Score ${Math.round(displayedScore)}/100`
        : `BA Score ${Math.round(displayedScore)}/100`;

    topLeft.appendChild(
        score
    );

    const year =
        document.createElement(
            "span"
        );

    year.className =
        "research-result-year";

    year.textContent =
        result.year
            ? String(result.year)
            : "-";

    top.appendChild(
        topLeft
    );

    top.appendChild(
        year
    );


    /* ---------- TITLE ---------- */

    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        result.title ||
        (
            currentLanguage === "ar"
                ? "بدون عنوان"
                : "Untitled"
        );


    /* ---------- AUTHORS ---------- */

    const authors =
        document.createElement(
            "p"
        );

    authors.className =
        "research-result-authors";

    authors.textContent =
        getAuthorsText(
            result.authors
        );


    /* ---------- JOURNAL / VENUE ---------- */

    const source =
        document.createElement(
            "p"
        );

    source.className =
        "research-result-source";

    source.textContent =
        result.sourceName ||
        (
            currentLanguage === "ar"
                ? "المصدر غير متوفر"
                : "Source unavailable"
        );


    /* ---------- PROVIDERS ---------- */

    const providers =
        document.createElement(
            "div"
        );

    providers.className =
        "research-provider-list";

    (
        Array.isArray(
            result.sources
        )
            ? result.sources
            : []
    )
        .forEach(
            (provider) => {

                const badge =
                    document.createElement(
                        "span"
                    );

                badge.textContent =
                    provider;

                providers.appendChild(
                    badge
                );

            }
        );


    /* ---------- META ---------- */

    const meta =
        document.createElement(
            "div"
        );

    meta.className =
        "research-result-meta";

    const citations =
        document.createElement(
            "span"
        );

    citations.textContent =
        currentLanguage === "ar"
            ? `الاستشهادات: ${result.citedByCount || 0}`
            : `Citations: ${result.citedByCount || 0}`;

    const openAccess =
        document.createElement(
            "span"
        );

    openAccess.textContent =
        result.isOpenAccess
            ? (
                currentLanguage === "ar"
                    ? "وصول مفتوح"
                    : "Open Access"
            )
            : (
                currentLanguage === "ar"
                    ? "وصول محدود"
                    : "Restricted Access"
            );

    meta.appendChild(
        citations
    );

    meta.appendChild(
        openAccess
    );


    /* ---------- ACTIONS ---------- */

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "research-result-actions";

    const sourceButton =
        document.createElement(
            "a"
        );

    sourceButton.className =
        "research-result-open";

    sourceButton.textContent =
        currentLanguage === "ar"
            ? "فتح المصدر"
            : "Open Source";

    const safeUrl =
        getSafeUrl(
            result.url
        );

    if (safeUrl) {

        sourceButton.href =
            safeUrl;

        sourceButton.target =
            "_blank";

        sourceButton.rel =
            "noopener noreferrer";

    } else {

        sourceButton.setAttribute(
            "aria-disabled",
            "true"
        );

    }

    const detailsButton =
        document.createElement(
            "a"
        );

    detailsButton.className =
        "research-result-details";

    detailsButton.textContent =
        currentLanguage === "ar"
            ? "عرض التفاصيل"
            : "View Details";

    if (
        result.openAlexId
    ) {

        detailsButton.href =
            `./paper.html?id=${encodeURIComponent(result.openAlexId)}`;

    } else {

        detailsButton.setAttribute(
            "aria-disabled",
            "true"
        );

        detailsButton.title =
            currentLanguage === "ar"
                ? "التفاصيل الداخلية متاحة حاليًا للأوراق المرتبطة بـ OpenAlex."
                : "Internal details are currently available for OpenAlex-linked papers.";

    }

    actions.appendChild(
        sourceButton
    );

    actions.appendChild(
        detailsButton
    );


    /* ---------- ASSEMBLE ---------- */

    article.appendChild(
        top
    );

    article.appendChild(
        title
    );

    article.appendChild(
        authors
    );

    article.appendChild(
        source
    );

    article.appendChild(
        providers
    );

    article.appendChild(
        meta
    );

    article.appendChild(
        actions
    );

    return article;

}


/* =========================
   RESULT COUNT
========================= */

function renderResultsCount() {

    if (!resultsCount) {
        return;
    }

    if (!currentQuery) {

        resultsCount.textContent =
            "";

        return;

    }

    const count =
        allResults.length;

    const formatted =
        new Intl.NumberFormat(
            currentLanguage === "ar"
                ? "ar"
                : "en"
        ).format(
            count
        );

    const modeSuffix =
    activeSearchMode ===
        "openalex-fallback"

        ? (
            currentLanguage === "ar"
                ? " · OpenAlex فقط"
                : " · OpenAlex only"
        )

        : (
            activeSearchMode ===
                "hybrid"

                ? " · BA Hybrid"

                : ""
        );

    resultsCount.textContent =
        currentLanguage === "ar"
            ? `${formatted} نتيجة موحّدة${modeSuffix}`
            : `${formatted} unified results${modeSuffix}`;

}


/* =========================
   LOAD MORE
========================= */

function updateLoadMoreVisibility() {

    if (!loadMoreContainer) {
        return;
    }

    loadMoreContainer.hidden =
        visibleResults >=
        allResults.length;

}

if (loadMoreButton) {

    loadMoreButton.addEventListener(
        "click",
        () => {

            visibleResults +=
                RESULTS_INCREMENT;

            renderResults();
            updateLoadMoreVisibility();

        }
    );

}


/* =========================
   SEARCH SUBMIT
========================= */

if (
    searchForm &&
    searchInput
) {

    searchForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const query =
                searchInput.value
                    .trim();

            if (!query) {
                return;
            }

            currentQuery =
                query;

            allResults =
                [];

            resultsContainer
                ?.replaceChildren();

            renderResultsCount();

            await searchResearch(
                query
            );

        }
    );

}


/* =========================
   HELPERS
========================= */

function getAuthorsText(
    authors
) {

    if (
        !Array.isArray(authors) ||
        authors.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلف غير متوفر"
            : "Author unavailable";

    }

    const names =
        authors
            .slice(
                0,
                4
            )
            .map(
                author =>
                    typeof author === "string"
                        ? author
                        : author?.name
            )
            .filter(Boolean);

    if (
        names.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلف غير متوفر"
            : "Author unavailable";

    }

    let text =
        names.join(", ");

    if (
        authors.length > 4
    ) {

        text +=
            currentLanguage === "ar"
                ? " وآخرون"
                : " et al.";

    }

    return text;

}

function getOpenAlexWorkId(
    value
) {

    if (
        typeof value !== "string"
    ) {
        return null;
    }

    const match =
        value.match(
            /W\d+$/i
        );

    return match
        ? match[0]
        : null;

}

function normalizeDoi(
    value
) {

    if (
        typeof value !== "string"
    ) {
        return null;
    }

    return value
        .trim()
        .toLowerCase()
        .replace(
            /^https?:\/\/(dx\.)?doi\.org\//,
            ""
        )
        .replace(
            /^doi:\s*/,
            ""
        ) ||
        null;

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

    let candidate =
        value.trim();

    const doi =
        normalizeDoi(
            candidate
        );

    if (
        doi &&
        (
            candidate.startsWith("10.") ||
            candidate.includes("doi.org/")
        )
    ) {

        candidate =
            `https://doi.org/${doi}`;

    }

    try {

        const url =
            new URL(
                candidate
            );

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {

            return url.href;

        }

    }

    catch {
        return null;
    }

    return null;

}

function calculateLexicalRelevance(
    query,
    text
) {

    const queryTokens =
        tokenize(
            query
        );

    if (
        queryTokens.length === 0
    ) {
        return 0;
    }

    const haystack =
        new Set(
            tokenize(
                text
            )
        );

    const matches =
        queryTokens.filter(
            token =>
                haystack.has(
                    token
                )
        ).length;

    return matches /
        queryTokens.length;

}

function tokenize(
    value
) {

    if (
        typeof value !== "string"
    ) {
        return [];
    }

    return value
        .toLowerCase()
        .normalize("NFKC")
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .split(/\s+/)
        .map(
            token =>
                token.trim()
        )
        .filter(
            token =>
                token.length > 2
        );

}

function calculateMetadataScore(
    item
) {

    const fields =
        [
            item.title,
            item.year,
            item.sourceName,
            item.doi,
            item.url,
            Array.isArray(item.authors) &&
                item.authors.length > 0
        ];

    const present =
        fields.filter(Boolean)
            .length;

    return present /
        fields.length;

}

function clamp01(
    value
) {

    return Math.min(
        1,
        Math.max(
            0,
            Number(value) || 0
        )
    );

}
