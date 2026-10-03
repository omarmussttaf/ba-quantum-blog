/* =========================================================
   BA SCIENCE
   File: paper.js

   Purpose:
   - Load one scientific work from OpenAlex
   - Render scientific paper details
   - Switch BA interface language
   - Detect authenticated user
   - Detect whether the paper is already saved
   - Save paper to Supabase
   - Prevent duplicate saves

   Security Notes:
   - No secret API keys.
   - OpenAlex content is rendered using textContent.
   - External URLs are restricted to HTTP / HTTPS.
   - Supabase RLS remains the authorization layer.
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const languageButton =
    document.querySelector(
        "#languageButton"
    );


const statusElement =
    document.querySelector(
        "#paperDetailStatus"
    );


const paperCard =
    document.querySelector(
        "#paperDetailCard"
    );


const savePaperButton =
    document.querySelector(
        "#savePaperButton"
    );



/* =========================================================
   STATE
========================================================= */

let currentPaper =
    null;


let currentUser =
    null;


let currentSavedPaperId =
    null;


let currentLanguage =
    localStorage.getItem(
        "ba-language"
    ) || "ar";



/* =========================================================
   LANGUAGE
========================================================= */

function changeLanguage(language) {

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";


    /*
       Translate static BA interface elements.
    */

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
            ? "BA Science | تفاصيل البحث"
            : "BA Science | Paper Details";


    currentLanguage =
        safeLanguage;


    localStorage.setItem(
        "ba-language",
        safeLanguage
    );


    /*
       Some information is dynamically created
       from JavaScript.

       Re-render it when the interface language changes.
    */

    if (currentPaper) {

        const paperId =
            getPaperId();


        if (paperId) {

            renderPaper(
                currentPaper,
                paperId
            );

        }

    }


    /*
       Also update Save / Saved button language.
    */

    updateSavePaperButton();

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
   TEXT HELPER
========================================================= */

function setText(
    selector,
    value
) {

    const element =
        document.querySelector(
            selector
        );


    if (!element) {

        return;

    }


    element.textContent =
        value ?? "-";

}



/* =========================================================
   STATUS
========================================================= */

function showStatus(
    arabicMessage,
    englishMessage
) {

    if (!statusElement) {

        return;

    }


    statusElement.textContent =
        currentLanguage === "ar"
            ? arabicMessage
            : englishMessage;

}



/* =========================================================
   GET PAPER ID
========================================================= */

function getPaperId() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const rawId =
        params.get(
            "id"
        );


    if (!rawId) {

        return null;

    }


    /*
       Accepted examples:

       W2741809807

       or

       https://openalex.org/W2741809807
    */

    const match =
        rawId.match(
            /W\d+$/i
        );


    if (!match) {

        return null;

    }


    return match[0];

}



/* =========================================================
   LOAD PAPER FROM OPENALEX
========================================================= */

async function loadPaper() {

    const paperId =
        getPaperId();


    if (!paperId) {

        showStatus(
            "معرّف الورقة غير صالح.",
            "Invalid paper identifier."
        );


        return;

    }


    showStatus(
        "جارٍ تحميل تفاصيل الورقة...",
        "Loading paper details..."
    );


    try {

        const response =
            await fetch(
                `https://api.openalex.org/works/${encodeURIComponent(
                    paperId
                )}`,
                {
                    method: "GET",

                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `OpenAlex error: ${response.status}`
            );

        }


        const work =
            await response.json();


        /*
           Store work in page state.
        */

        currentPaper =
            work;


        renderPaper(
            work,
            paperId
        );


        showStatus(
            "",
            ""
        );


        if (paperCard) {

            paperCard.hidden =
                false;

        }

    }

    catch (error) {

        console.error(
            "BA: Unable to load paper.",
            error
        );


        showStatus(
            "تعذر تحميل تفاصيل الورقة.",
            "Unable to load paper details."
        );

    }

}



/* =========================================================
   RENDER PAPER
========================================================= */

function renderPaper(
    work,
    paperId
) {

    if (
        !work ||
        typeof work !== "object"
    ) {

        return;

    }


    /* =========================
       TITLE
    ========================= */

    const title =
        work.display_name ||
        work.title ||
        (
            currentLanguage === "ar"
                ? "بدون عنوان"
                : "Untitled"
        );


    setText(
        "#paperTitle",
        cleanResearchTitle(
            title
        )
    );



    /* =========================
       YEAR
    ========================= */

    setText(
        "#paperYear",
        work.publication_year ||
        "-"
    );



    /* =========================
       AUTHORS
    ========================= */

    setText(
        "#paperAuthors",
        getAuthorsText(
            work.authorships
        )
    );



    /* =========================
       SOURCE
    ========================= */

    setText(
        "#paperSource",

        work
            ?.primary_location
            ?.source
            ?.display_name

        ||

        (
            currentLanguage === "ar"
                ? "المصدر غير متوفر"
                : "Source unavailable"
        )
    );



    /* =========================
       CITATIONS
    ========================= */

    setText(
        "#paperCitations",
        work.cited_by_count || 0
    );



    /* =========================
       OPEN ACCESS
    ========================= */

    setText(
        "#paperOpenAccess",

        work
            ?.open_access
            ?.is_oa

            ? (
                currentLanguage === "ar"
                    ? "وصول مفتوح"
                    : "Open Access"
            )

            : (
                currentLanguage === "ar"
                    ? "وصول محدود"
                    : "Restricted"
            )
    );



    /* =========================
       DOI
    ========================= */

    setText(
        "#paperDoi",
        work.doi || "-"
    );



    /* =========================
       OPENALEX ID
    ========================= */

    setText(
        "#paperOpenAlexId",
        paperId
    );



    /* =========================
       ABSTRACT
    ========================= */

    setText(
        "#paperAbstract",
        reconstructAbstract(
            work.abstract_inverted_index
        )
    );



    /* =========================
       TOPICS
    ========================= */

    renderTopics(
        work.topics
    );



    /* =========================
       SOURCE LINK
    ========================= */

    renderSourceLink(
        work
    );

}



/* =========================================================
   CLEAN TITLE
========================================================= */

function cleanResearchTitle(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";

    }


    return value
        .trim()

        .replace(
            /\.{2,}$/g,
            ""
        )

        .replace(
            /…+$/g,
            ""
        )

        .trim();

}



/* =========================================================
   AUTHORS
========================================================= */

function getAuthorsText(
    authorships
) {

    if (
        !Array.isArray(
            authorships
        ) ||
        authorships.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلفون غير متوفرين"
            : "Authors unavailable";

    }


    const names =
        authorships
            .map(
                (item) =>
                    item
                        ?.author
                        ?.display_name
            )

            .filter(
                Boolean
            );


    if (
        names.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلفون غير متوفرين"
            : "Authors unavailable";

    }


    return names.join(
        ", "
    );

}



/* =========================================================
   ABSTRACT
========================================================= */

function reconstructAbstract(
    invertedIndex
) {

    if (
        !invertedIndex ||
        typeof invertedIndex !==
            "object"
    ) {

        return currentLanguage === "ar"
            ? "الملخص غير متوفر لهذه الورقة."
            : "Abstract unavailable for this paper.";

    }


    const words =
        [];


    Object.entries(
        invertedIndex
    ).forEach(
        ([word, positions]) => {

            if (
                !Array.isArray(
                    positions
                )
            ) {

                return;

            }


            positions.forEach(
                (position) => {

                    if (
                        Number.isInteger(
                            position
                        ) &&
                        position >= 0
                    ) {

                        words[position] =
                            word;

                    }

                }
            );

        }
    );


    const abstract =
        words
            .filter(
                (word) =>
                    typeof word ===
                    "string"
            )

            .join(
                " "
            )

            .trim();


    return abstract ||
        (
            currentLanguage === "ar"
                ? "الملخص غير متوفر لهذه الورقة."
                : "Abstract unavailable for this paper."
        );

}



/* =========================================================
   TOPICS
========================================================= */

function renderTopics(
    topics
) {

    const container =
        document.querySelector(
            "#paperTopics"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    if (
        !Array.isArray(
            topics
        ) ||
        topics.length === 0
    ) {

        container.textContent =
            currentLanguage === "ar"
                ? "لا توجد موضوعات متاحة."
                : "No topics available.";


        return;

    }


    topics
        .slice(
            0,
            8
        )

        .forEach(
            (topic) => {

                const name =
                    topic
                        ?.display_name;


                if (
                    typeof name !==
                        "string" ||
                    !name.trim()
                ) {

                    return;

                }


                const tag =
                    document.createElement(
                        "span"
                    );


                /*
                   textContent protects against HTML injection.
                */

                tag.textContent =
                    name.trim();


                container.appendChild(
                    tag
                );

            }
        );

}



/* =========================================================
   SOURCE LINK
========================================================= */

function renderSourceLink(
    work
) {

    const sourceLink =
        document.querySelector(
            "#paperSourceLink"
        );


    if (!sourceLink) {

        return;

    }


    /*
       Reset previous state first.
    */

    sourceLink.removeAttribute(
        "href"
    );


    sourceLink.removeAttribute(
        "aria-disabled"
    );


    const candidates =
        [
            work?.doi,

            work
                ?.best_oa_location
                ?.landing_page_url,

            work
                ?.primary_location
                ?.landing_page_url,

            work
                ?.primary_location
                ?.pdf_url
        ];


    const safeUrl =
        candidates
            .map(
                getSafeUrl
            )

            .find(
                Boolean
            );


    if (!safeUrl) {

        sourceLink.setAttribute(
            "aria-disabled",
            "true"
        );


        return;

    }


    sourceLink.href =
        safeUrl;

}



/* =========================================================
   SAFE URL
========================================================= */

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
            url.protocol !==
                "https:" &&
            url.protocol !==
                "http:"
        ) {

            return null;

        }


        return url.href;

    }

    catch {

        return null;

    }

}



/* =========================================================
   GET CURRENT USER
========================================================= */

async function loadCurrentUser() {

    if (!window.baSupabase) {

        console.error(
            "BA: Supabase client is not available."
        );


        currentUser =
            null;


        updateSavePaperButton();


        return;

    }


    try {

        const {
            data,
            error
        } =
            await window.baSupabase
                .auth
                .getUser();


        if (error) {

            console.error(
                "BA: Unable to verify current user."
            );


            currentUser =
                null;


            updateSavePaperButton();


            return;

        }


        currentUser =
            data?.user || null;


        updateSavePaperButton();

    }

    catch (error) {

        console.error(
            "BA: Unexpected authentication error.",
            error
        );


        currentUser =
            null;


        updateSavePaperButton();

    }

}



/* =========================================================
   CHECK IF PAPER IS SAVED
========================================================= */

async function checkIfPaperIsSaved() {

    if (
        !window.baSupabase ||
        !currentUser
    ) {

        currentSavedPaperId =
            null;


        updateSavePaperButton();


        return;

    }


    const openAlexId =
        getPaperId();


    if (!openAlexId) {

        currentSavedPaperId =
            null;


        updateSavePaperButton();


        return;

    }


    try {

        const {
            data,
            error
        } =
            await window.baSupabase
                .from(
                    "saved_papers"
                )

                .select(
                    "id"
                )

                .eq(
                    "user_id",
                    currentUser.id
                )

                .eq(
                    "openalex_id",
                    openAlexId
                )

                .maybeSingle();


        if (error) {

            console.error(
                "BA: Unable to check saved paper status."
            );


            return;

        }


        currentSavedPaperId =
            data?.id || null;


        updateSavePaperButton();

    }

    catch (error) {

        console.error(
            "BA: Unexpected saved paper status error.",
            error
        );

    }

}



/* =========================================================
   UPDATE SAVE BUTTON
========================================================= */

function updateSavePaperButton() {

    if (!savePaperButton) {

        return;

    }


    /*
       Clear temporary saving state.
    */

    savePaperButton.removeAttribute(
        "aria-busy"
    );


    /* =========================
       NOT LOGGED IN
    ========================= */

    if (!currentUser) {

        savePaperButton.disabled =
            false;


        savePaperButton.classList.remove(
            "is-saved"
        );


        savePaperButton.textContent =
            currentLanguage === "ar"
                ? "حفظ الورقة"
                : "Save Paper";


        return;

    }


    /* =========================
       ALREADY SAVED
    ========================= */

    if (currentSavedPaperId) {

        savePaperButton.disabled =
            true;


        savePaperButton.classList.add(
            "is-saved"
        );


        savePaperButton.textContent =
            currentLanguage === "ar"
                ? "✓ محفوظة"
                : "✓ Saved";


        return;

    }


    /* =========================
       NOT SAVED
    ========================= */

    savePaperButton.disabled =
        false;


    savePaperButton.classList.remove(
        "is-saved"
    );


    savePaperButton.textContent =
        currentLanguage === "ar"
            ? "حفظ الورقة"
            : "Save Paper";

}



/* =========================================================
   SAVE PAPER
========================================================= */

if (savePaperButton) {

    savePaperButton.addEventListener(
        "click",
        async () => {


            /* =========================
               AUTH REQUIRED
            ========================= */

            if (!currentUser) {

                alert(
                    currentLanguage === "ar"
                        ? "سجل الدخول أولًا لحفظ الورقة."
                        : "Please sign in first to save this paper."
                );


                window.location.href =
                    "./login.html";


                return;

            }



            /* =========================
               ALREADY SAVED
            ========================= */

            if (currentSavedPaperId) {

                return;

            }



            /* =========================
               PAPER MUST BE LOADED
            ========================= */

            if (!currentPaper) {

                return;

            }



            const openAlexId =
                getPaperId();


            if (!openAlexId) {

                alert(
                    currentLanguage === "ar"
                        ? "تعذر تحديد معرّف الورقة."
                        : "Unable to identify this paper."
                );


                return;

            }



            /* =========================
               SAVING UI
            ========================= */

            savePaperButton.disabled =
                true;


            savePaperButton.setAttribute(
                "aria-busy",
                "true"
            );


            savePaperButton.textContent =
                currentLanguage === "ar"
                    ? "جارٍ الحفظ..."
                    : "Saving...";


            try {

                const authors =
                    getAuthorsArray(
                        currentPaper.authorships
                    );


                const sourceUrl =
                    getBestSourceUrl(
                        currentPaper
                    );


                /*
                   Insert paper and return the new saved row ID.
                */

                const {
                    data: savedPaper,
                    error
                } =
                    await window.baSupabase
                        .from(
                            "saved_papers"
                        )

                        .insert({

                            user_id:
                                currentUser.id,

                            openalex_id:
                                openAlexId,

                            title:
                                currentPaper.display_name ||
                                currentPaper.title ||
                                "Untitled",

                            doi:
                                currentPaper.doi ||
                                null,

                            publication_year:
                                currentPaper.publication_year ||
                                null,

                            source_name:
                                currentPaper
                                    ?.primary_location
                                    ?.source
                                    ?.display_name
                                || null,

                            authors:
                                authors,

                            is_open_access:
                                Boolean(
                                    currentPaper
                                        ?.open_access
                                        ?.is_oa
                                ),

                            cited_by_count:
                                currentPaper.cited_by_count ||
                                0,

                            source_url:
                                sourceUrl

                        })

                        .select(
                            "id"
                        )

                        .single();



                /* =========================
                   DATABASE ERROR
                ========================= */

                if (error) {

                    /*
                       PostgreSQL unique violation.

                       This means the paper already exists
                       for this user.
                    */

                    if (
                        error.code ===
                        "23505"
                    ) {

                        await checkIfPaperIsSaved();


                        alert(
                            currentLanguage === "ar"
                                ? "هذه الورقة محفوظة بالفعل."
                                : "This paper is already saved."
                        );


                        return;

                    }


                    throw error;

                }



                /* =========================
                   STORE SAVED ID
                ========================= */

                currentSavedPaperId =
                    savedPaper?.id ||
                    null;



                /*
                   If for any unexpected reason Supabase
                   did not return an ID, verify against DB.
                */

                if (!currentSavedPaperId) {

                    await checkIfPaperIsSaved();

                }



                /* =========================
                   UPDATE BUTTON
                ========================= */

                updateSavePaperButton();



                /* =========================
                   SUCCESS
                ========================= */

                alert(
                    currentLanguage === "ar"
                        ? "تم حفظ الورقة بنجاح."
                        : "Paper saved successfully."
                );

            }

            catch (error) {

                console.error(
                    "BA: Unable to save paper.",
                    error
                );


                alert(
                    currentLanguage === "ar"
                        ? "تعذر حفظ الورقة حاليًا."
                        : "Unable to save this paper right now."
                );

            }

            finally {

                /*
                   Never blindly enable the button here.

                   If the paper was saved successfully,
                   updateSavePaperButton() keeps it disabled
                   and displays ✓ Saved.
                */

                updateSavePaperButton();

            }

        }
    );

}



/* =========================================================
   AUTHORS ARRAY FOR DATABASE
========================================================= */

function getAuthorsArray(
    authorships
) {

    if (
        !Array.isArray(
            authorships
        )
    ) {

        return [];

    }


    return authorships
        .map(
            (item) =>
                item
                    ?.author
                    ?.display_name
        )

        .filter(
            (name) =>
                typeof name ===
                    "string" &&
                name.trim()
        )

        .map(
            (name) =>
                name.trim()
        );

}



/* =========================================================
   BEST SOURCE URL
========================================================= */

function getBestSourceUrl(
    work
) {

    const candidates =
        [
            work?.doi,

            work
                ?.best_oa_location
                ?.landing_page_url,

            work
                ?.primary_location
                ?.landing_page_url,

            work
                ?.primary_location
                ?.pdf_url
        ];


    return candidates
        .map(
            getSafeUrl
        )

        .find(
            Boolean
        )

        || null;

}



/* =========================================================
   INITIALIZE PAGE
========================================================= */

async function initializePaperPage() {

    /*
       Step 1:
       Identify signed-in user.
    */

    await loadCurrentUser();


    /*
       Step 2:
       Load OpenAlex paper.
    */

    await loadPaper();


    /*
       Step 3:
       If signed in, check whether this paper
       already exists in user's scientific library.
    */

    await checkIfPaperIsSaved();

}



/* =========================================================
   START
========================================================= */

initializePaperPage();