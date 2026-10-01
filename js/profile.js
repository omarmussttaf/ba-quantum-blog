/* =========================================================
   BA PROJECT
   File: profile.js

   Purpose:
   - Load authenticated user's scientific profile
   - Language switching
   - Display profile information
   - Display saved scientific papers
   - Remove saved papers
   - Logout

   Security:
   - Authorization is enforced by Supabase RLS
   - User content is rendered with textContent
   - External URLs are restricted to HTTP / HTTPS
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const languageButton =
    document.querySelector(
        "#languageButton"
    );


const logoutButton =
    document.querySelector(
        "#logoutButton"
    );


const savedPapersList =
    document.querySelector(
        "#savedPapersList"
    );


const savedPapersStatus =
    document.querySelector(
        "#savedPapersStatus"
    );



/* =========================================================
   STATE
========================================================= */

let currentLanguage =
    localStorage.getItem(
        "ba-language"
    ) || "ar";


let currentSavedPapers =
    [];



/* =========================================================
   LANGUAGE
========================================================= */

function changeLanguage(language) {

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";


    /* Static HTML elements */

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


    /* Page language */

    document.documentElement.lang =
        safeLanguage;


    document.documentElement.dir =
        safeLanguage === "ar"
            ? "rtl"
            : "ltr";


    /* Language button */

    if (languageButton) {

        languageButton.textContent =
            safeLanguage === "ar"
                ? "EN"
                : "AR";

    }


    currentLanguage =
        safeLanguage;


    localStorage.setItem(
        "ba-language",
        safeLanguage
    );


    /*
       Saved paper cards are created dynamically
       by JavaScript.

       Re-render them when language changes.
    */

    if (
        Array.isArray(
            currentSavedPapers
        ) &&
        currentSavedPapers.length > 0
    ) {

        renderSavedPapers(
            currentSavedPapers
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
   SAFE TEXT
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

        console.error(
            `BA: Missing HTML element: ${selector}`
        );

        return;

    }


    element.textContent =
        value ?? "-";

}



/* =========================================================
   SAFE EXTERNAL URL
========================================================= */

function getSafeExternalUrl(
    value
) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        return null;

    }


    let normalizedUrl =
        value.trim();


    /*
       example.com
       becomes
       https://example.com
    */

    if (
        !normalizedUrl.startsWith(
            "http://"
        ) &&
        !normalizedUrl.startsWith(
            "https://"
        )
    ) {

        normalizedUrl =
            `https://${normalizedUrl}`;

    }


    try {

        const parsedUrl =
            new URL(
                normalizedUrl
            );


        if (
            parsedUrl.protocol !==
                "http:" &&
            parsedUrl.protocol !==
                "https:"
        ) {

            return null;

        }


        return parsedUrl.href;

    }

    catch {

        return null;

    }

}



/* =========================================================
   SAFE AVATAR URL
========================================================= */

function getSafeAvatarUrl(
    value
) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        return null;

    }


    try {

        const parsedUrl =
            new URL(
                value
            );


        if (
            parsedUrl.protocol !==
                "http:" &&
            parsedUrl.protocol !==
                "https:"
        ) {

            return null;

        }


        return parsedUrl.href;

    }

    catch {

        return null;

    }

}



/* =========================================================
   AVATAR FALLBACK
========================================================= */

function showAvatarInitials(
    avatarImage,
    avatarInitials,
    initials
) {

    if (avatarImage) {

        avatarImage.removeAttribute(
            "src"
        );


        avatarImage.style.display =
            "none";

    }


    if (avatarInitials) {

        avatarInitials.style.display =
            "grid";


        avatarInitials.textContent =
            initials || "BA";

    }

}



/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    try {

        ensureSupabaseClient();



        /* =========================
           GET AUTHENTICATED USER
        ========================= */

        const {
            data: userData,
            error: userError
        } =
            await window.baSupabase
                .auth
                .getUser();


        if (
            userError ||
            !userData?.user
        ) {

            if (userError) {

                console.error(
                    "BA: Unable to verify current session."
                );

            }


            window.location.replace(
                "./login.html"
            );


            return;

        }


        const user =
            userData.user;



        /* =========================
           GET PROFILE
        ========================= */

        const {
            data: profile,
            error: profileError
        } =
            await window.baSupabase
                .from(
                    "profiles"
                )
                .select(`
                    id,
                    full_name,
                    account_type,
                    scientific_field,
                    bio,
                    institution,
                    country,
                    city,
                    orcid,
                    avatar_url,
                    website,
                    interests
                `)
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "BA: Unable to load profile."
            );


            showProfileLoadError();


            return;

        }


        if (!profile) {

            console.error(
                "BA: No profile record exists for the authenticated user."
            );


            showProfileLoadError();


            return;

        }



        /* =========================
           NORMALIZE VALUES
        ========================= */

        const fullName =
            typeof profile.full_name ===
                "string" &&
            profile.full_name.trim()
                ? profile.full_name.trim()
                : "BA User";


        const accountType =
            profile.account_type ||
            "-";


        const scientificField =
            profile.scientific_field ||
            "-";


        const bio =
            profile.bio ||
            "-";


        const institution =
            profile.institution ||
            "-";


        const city =
            profile.city ||
            "";


        const country =
            profile.country ||
            "";


        const orcid =
            profile.orcid ||
            "-";


        const website =
            profile.website ||
            "";


        const interests =
            Array.isArray(
                profile.interests
            )
                ? profile.interests
                : [];



        /* =========================
           BASIC PROFILE
        ========================= */

        setText(
            "#profileName",
            fullName
        );


        setText(
            "#profileEmail",
            user.email || "-"
        );


        setText(
            "#profileAccountType",
            accountType
        );


        setText(
            "#profileField",
            scientificField
        );


        setText(
            "#profileRole",
            scientificField !== "-"
                ? scientificField
                : accountType
        );



        /* =========================
           EXTENDED PROFILE
        ========================= */

        setText(
            "#profileBio",
            bio
        );


        setText(
            "#profileInstitution",
            institution
        );


        const location =
            [
                city,
                country
            ]
                .filter(
                    Boolean
                )
                .join(
                    ", "
                );


        setText(
            "#profileLocation",
            location || "-"
        );


        setText(
            "#profileOrcid",
            orcid
        );



        /* =========================
           WEBSITE
        ========================= */

        renderWebsite(
            website
        );



        /* =========================
           SCIENTIFIC INTERESTS
        ========================= */

        renderInterests(
            interests
        );



        /* =========================
           AVATAR
        ========================= */

        renderAvatar(
            fullName,
            profile.avatar_url
        );



        /* =========================
           SAVED PAPERS
        ========================= */

        await loadSavedPapers(
            user.id
        );

    }

    catch (error) {

        console.error(
            "BA: Unexpected profile loading error.",
            error
        );


        showProfileLoadError();

    }

}



/* =========================================================
   WEBSITE
========================================================= */

function renderWebsite(
    website
) {

    const websiteElement =
        document.querySelector(
            "#profileWebsite"
        );


    if (!websiteElement) {

        console.error(
            "BA: Missing HTML element: #profileWebsite"
        );

        return;

    }


    websiteElement.removeAttribute(
        "href"
    );


    websiteElement.removeAttribute(
        "target"
    );


    websiteElement.removeAttribute(
        "rel"
    );


    if (!website) {

        websiteElement.textContent =
            "-";

        return;

    }


    const safeUrl =
        getSafeExternalUrl(
            website
        );


    if (!safeUrl) {

        websiteElement.textContent =
            website;

        return;

    }


    websiteElement.textContent =
        website;


    websiteElement.href =
        safeUrl;


    websiteElement.target =
        "_blank";


    websiteElement.rel =
        "noopener noreferrer";

}



/* =========================================================
   INTERESTS
========================================================= */

function renderInterests(
    interests
) {

    const interestsElement =
        document.querySelector(
            "#profileInterests"
        );


    if (!interestsElement) {

        console.error(
            "BA: Missing HTML element: #profileInterests"
        );

        return;

    }


    interestsElement.replaceChildren();


    const safeInterests =
        interests.filter(
            (interest) => {

                return (
                    typeof interest ===
                        "string" &&
                    interest.trim()
                );

            }
        );


    if (
        safeInterests.length === 0
    ) {

        interestsElement.textContent =
            "-";

        return;

    }


    safeInterests.forEach(
        (interest) => {

            const tag =
                document.createElement(
                    "span"
                );


            tag.textContent =
                interest.trim();


            interestsElement.appendChild(
                tag
            );

        }
    );

}



/* =========================================================
   AVATAR
========================================================= */

function renderAvatar(
    fullName,
    avatarUrl
) {

    const avatarImage =
        document.querySelector(
            "#profileAvatarImage"
        );


    const avatarInitials =
        document.querySelector(
            "#profileAvatarInitials"
        );


    if (
        !avatarImage ||
        !avatarInitials
    ) {

        console.error(
            "BA: Avatar HTML elements are missing."
        );

        return;

    }


    const initials =
        fullName
            .split(
                /\s+/
            )
            .filter(
                Boolean
            )
            .slice(
                0,
                2
            )
            .map(
                (name) =>
                    name.charAt(
                        0
                    )
            )
            .join(
                ""
            )
            .toUpperCase();


    const safeAvatarUrl =
        getSafeAvatarUrl(
            avatarUrl
        );


    if (!safeAvatarUrl) {

        showAvatarInitials(
            avatarImage,
            avatarInitials,
            initials
        );


        return;

    }


    avatarImage.style.display =
        "none";


    avatarInitials.style.display =
        "grid";


    avatarInitials.textContent =
        initials || "BA";


    avatarImage.onload =
        () => {

            avatarImage.style.display =
                "block";


            avatarInitials.style.display =
                "none";

        };


    avatarImage.onerror =
        () => {

            showAvatarInitials(
                avatarImage,
                avatarInitials,
                initials
            );

        };


    avatarImage.src =
        safeAvatarUrl;

}



/* =========================================================
   PROFILE ERROR
========================================================= */

function showProfileLoadError() {

    alert(
        currentLanguage === "ar"
            ? "تعذر تحميل الملف العلمي حاليًا. حاول مرة أخرى."
            : "Unable to load your scientific profile right now. Please try again."
    );

}



/* =========================================================
   LOAD SAVED PAPERS
========================================================= */

async function loadSavedPapers(
    userId
) {

    if (
        !window.baSupabase ||
        !userId
    ) {

        return;

    }


    if (savedPapersStatus) {

        savedPapersStatus.textContent =
            currentLanguage === "ar"
                ? "جارٍ تحميل مكتبتك العلمية..."
                : "Loading your scientific library...";

    }


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
                userId
            )
            .order(
                "saved_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "BA: Unable to load saved papers."
        );


        if (savedPapersStatus) {

            savedPapersStatus.textContent =
                currentLanguage === "ar"
                    ? "تعذر تحميل الأبحاث المحفوظة."
                    : "Unable to load saved research.";

        }


        return;

    }


    currentSavedPapers =
        Array.isArray(data)
            ? data
            : [];


    renderSavedPapers(
        currentSavedPapers
    );

}



/* =========================================================
   RENDER SAVED PAPERS
========================================================= */

function renderSavedPapers(
    papers
) {

    if (!savedPapersList) {

        return;

    }


    savedPapersList.replaceChildren();


    const safePapers =
        Array.isArray(
            papers
        )
            ? papers
            : [];


    /* Real saved research count */

    setText(
        "#savedResearchCount",
        safePapers.length
    );


    if (
        safePapers.length === 0
    ) {

        if (savedPapersStatus) {

            savedPapersStatus.textContent =
                currentLanguage === "ar"
                    ? "لم تحفظ أي أبحاث حتى الآن."
                    : "You have not saved any research yet.";

        }


        return;

    }


    if (savedPapersStatus) {

        savedPapersStatus.textContent =
            "";

    }


    safePapers.forEach(
        (paper) => {

            /* =========================
               CARD
            ========================= */

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "saved-paper-card";



            /* =========================
               TOP
            ========================= */

            const top =
                document.createElement(
                    "div"
                );


            top.className =
                "saved-paper-top";


            const type =
                document.createElement(
                    "span"
                );


            type.className =
                "saved-paper-type";


            type.textContent =
                currentLanguage === "ar"
                    ? "ورقة علمية"
                    : "Scientific Paper";


            const year =
                document.createElement(
                    "span"
                );


            year.className =
                "saved-paper-year";


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
                    "h3"
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
                "saved-paper-authors";


            authors.textContent =
                getSavedPaperAuthors(
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
                "saved-paper-source";


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
                "saved-paper-meta";


            const citations =
                document.createElement(
                    "span"
                );


            const citationsCount =
                Number.isFinite(
                    Number(
                        paper.cited_by_count
                    )
                )
                    ? Number(
                        paper.cited_by_count
                    )
                    : 0;


            citations.textContent =
                currentLanguage === "ar"
                    ? `${citationsCount} استشهاد`
                    : `${citationsCount} citations`;


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
                "saved-paper-actions";



            /* View details */

            const detailsLink =
                document.createElement(
                    "a"
                );


            detailsLink.className =
                "saved-paper-details";


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



            /* Open original source */

            const sourceLink =
                document.createElement(
                    "a"
                );


            sourceLink.className =
                "saved-paper-source-link";


            sourceLink.textContent =
                currentLanguage === "ar"
                    ? "فتح المصدر"
                    : "Open Source";


            const safeSourceUrl =
                getSafeSavedPaperUrl(
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



            /* Remove saved paper */

            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.className =
                "saved-paper-delete";


            deleteButton.textContent =
                currentLanguage === "ar"
                    ? "إزالة"
                    : "Remove";


            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteSavedPaper(
                        paper.id
                    );

                }
            );


            actions.append(
                detailsLink,
                sourceLink,
                deleteButton
            );


            card.append(
                top,
                title,
                authors,
                source,
                meta,
                actions
            );


            savedPapersList.appendChild(
                card
            );

        }
    );

}



/* =========================================================
   DELETE SAVED PAPER
========================================================= */

async function deleteSavedPaper(
    savedPaperId
) {

    if (
        !savedPaperId ||
        !window.baSupabase
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


    /*
       Remove it from local state.
    */

    currentSavedPapers =
        currentSavedPapers.filter(
            (paper) =>
                paper.id !==
                savedPaperId
        );


    /*
       Re-render library and count.
    */

    renderSavedPapers(
        currentSavedPapers
    );

}



/* =========================================================
   SAVED PAPER AUTHORS
========================================================= */

function getSavedPaperAuthors(
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
        authors.filter(
            (author) => {

                return (
                    typeof author ===
                        "string" &&
                    author.trim()
                );

            }
        );


    if (
        safeAuthors.length === 0
    ) {

        return currentLanguage === "ar"
            ? "المؤلفون غير متوفرين"
            : "Authors unavailable";

    }


    const visibleAuthors =
        safeAuthors.slice(
            0,
            5
        );


    const authorsText =
        visibleAuthors.join(
            ", "
        );


    if (
        safeAuthors.length > 5
    ) {

        return (
            `${authorsText}, et al.`
        );

    }


    return authorsText;

}



/* =========================================================
   OPENALEX ID VALIDATION
========================================================= */

function isValidOpenAlexId(
    value
) {

    return (
        typeof value ===
            "string" &&
        /^W\d+$/i.test(
            value.trim()
        )
    );

}



/* =========================================================
   SAFE SAVED PAPER URL
========================================================= */

function getSafeSavedPaperUrl(
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
   LOGOUT
========================================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            logoutButton.disabled =
                true;


            try {

                ensureSupabaseClient();


                const {
                    error
                } =
                    await window.baSupabase
                        .auth
                        .signOut();


                if (error) {

                    console.error(
                        "BA: Logout failed."
                    );


                    alert(
                        currentLanguage === "ar"
                            ? "تعذر تسجيل الخروج. حاول مرة أخرى."
                            : "Unable to sign out. Please try again."
                    );


                    return;

                }


                window.location.replace(
                    "./login.html"
                );

            }

            catch (error) {

                console.error(
                    "BA: Unexpected logout error.",
                    error
                );


                alert(
                    currentLanguage === "ar"
                        ? "تعذر تسجيل الخروج حاليًا."
                        : "Unable to sign out right now."
                );

            }

            finally {

                logoutButton.disabled =
                    false;

            }

        }
    );

}



/* =========================================================
   START
========================================================= */

loadProfile();