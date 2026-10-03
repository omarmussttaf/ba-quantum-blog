/* =========================================================
   BA SCIENCE
   File: main.js

   Purpose:
   Controls the main landing page interface.

   Handles:
   - Mobile navigation
   - Language switching
   - RTL / LTR direction
   - Header scroll state
   - Active navigation highlighting
   - Basic accessibility states

   Security Notes:
   - No authentication or sensitive data belongs here.
   - User-controlled content should not be inserted with innerHTML.
   - localStorage is used only for non-sensitive UI preferences.
========================================================= */


/* =========================
   ELEMENTS
========================= */

const menuButton =
    document.querySelector(
        "#menuButton"
    );


const navLinks =
    document.querySelector(
        "#navLinks"
    );


const languageButton =
    document.querySelector(
        "#languageButton"
    );


const siteHeader =
    document.querySelector(
        ".site-header"
    );


const sections =
    document.querySelectorAll(
        "section[id]"
    );


const navItems =
    document.querySelectorAll(
        ".nav-links a"
    );



/* =========================
   STATE
========================= */

let currentLanguage =
    localStorage.getItem(
        "ba-language"
    ) || "ar";


let scrollScheduled =
    false;



/* =========================
   MOBILE MENU HELPERS
========================= */

function closeMobileMenu() {

    if (
        !navLinks ||
        !menuButton
    ) {

        return;

    }


    navLinks.classList.remove(
        "open"
    );


    document.body.classList.remove(
        "menu-open"
    );


    menuButton.textContent =
        "☰";


    menuButton.setAttribute(
        "aria-expanded",
        "false"
    );

}



function openMobileMenu() {

    if (
        !navLinks ||
        !menuButton
    ) {

        return;

    }


    navLinks.classList.add(
        "open"
    );


    document.body.classList.add(
        "menu-open"
    );


    menuButton.textContent =
        "×";


    menuButton.setAttribute(
        "aria-expanded",
        "true"
    );

}



/* =========================
   MOBILE MENU
========================= */

if (
    menuButton &&
    navLinks
) {

    /*
       Accessibility:
       Tell assistive technologies whether
       the navigation menu is open.
    */

    menuButton.setAttribute(
        "aria-expanded",
        "false"
    );


    menuButton.addEventListener(
        "click",
        () => {

            const isOpen =
                navLinks.classList.contains(
                    "open"
                );


            if (isOpen) {

                closeMobileMenu();

            } else {

                openMobileMenu();

            }

        }
    );


    const navigationLinks =
        navLinks.querySelectorAll(
            "a"
        );


    navigationLinks.forEach(
        (link) => {

            link.addEventListener(
                "click",
                () => {

                    closeMobileMenu();

                }
            );

        }
    );

}



/* =========================
   CLOSE MENU WITH ESCAPE
========================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
        ) {

            closeMobileMenu();

        }

    }
);



/* =========================
   LANGUAGE SYSTEM
========================= */

function changeLanguage(language) {

    /*
       BA currently supports only:
       - Arabic
       - English

       Any invalid value falls back to Arabic.
    */

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";


    const elements =
        document.querySelectorAll(
            "[data-ar][data-en]"
        );


    elements.forEach(
        (element) => {

            element.textContent =
                element.dataset[
                    safeLanguage
                ];

        }
    );



    /* =========================
       PLACEHOLDERS
    ========================= */

    /*
       This also allows future homepage
       forms/search fields to support AR/EN.
    */

    const placeholderElements =
        document.querySelectorAll(
            "[data-placeholder-ar][data-placeholder-en]"
        );


    placeholderElements.forEach(
        (element) => {

            element.placeholder =
                safeLanguage === "ar"
                    ? element.dataset.placeholderAr
                    : element.dataset.placeholderEn;

        }
    );



    /* =========================
       PAGE LANGUAGE
    ========================= */

    document.documentElement.lang =
        safeLanguage;


    document.documentElement.dir =
        safeLanguage === "ar"
            ? "rtl"
            : "ltr";



    /* =========================
       LANGUAGE BUTTON
    ========================= */

    if (languageButton) {

        languageButton.textContent =
            safeLanguage === "ar"
                ? "EN"
                : "AR";


        languageButton.setAttribute(
            "aria-label",
            safeLanguage === "ar"
                ? "Switch to English"
                : "التبديل إلى العربية"
        );

    }



    /* =========================
       PAGE TITLE
    ========================= */

    document.title =
        safeLanguage === "ar"
            ? "BA Science | العلم والبحث"
            : "BA Science | Science & Research";



    /* =========================
       SAVE PREFERENCE
    ========================= */

    currentLanguage =
        safeLanguage;


    localStorage.setItem(
        "ba-language",
        safeLanguage
    );

}



/* =========================
   LANGUAGE BUTTON
========================= */

if (languageButton) {

    languageButton.addEventListener(
        "click",
        () => {

            const newLanguage =
                currentLanguage === "ar"
                    ? "en"
                    : "ar";


            changeLanguage(
                newLanguage
            );


            closeMobileMenu();

        }
    );

}


changeLanguage(
    currentLanguage
);



/* =========================
   HEADER ON SCROLL
========================= */

function handleHeaderScroll() {

    if (!siteHeader) {

        return;

    }


    siteHeader.classList.toggle(
        "scrolled",
        window.scrollY > 40
    );

}



/* =========================
   ACTIVE NAVIGATION
========================= */

function updateActiveNavigation() {

    if (
        sections.length === 0 ||
        navItems.length === 0
    ) {

        return;

    }


    let currentSection =
        "home";


    const scrollPosition =
        window.scrollY + 170;



    sections.forEach(
        (section) => {

            const sectionTop =
                section.offsetTop;


            const sectionBottom =
                sectionTop +
                section.offsetHeight;


            if (
                scrollPosition >=
                    sectionTop &&
                scrollPosition <
                    sectionBottom
            ) {

                currentSection =
                    section.id;

            }

        }
    );



    navItems.forEach(
        (link) => {

            const href =
                link.getAttribute(
                    "href"
                );


            const isActive =
                href ===
                `#${currentSection}`;


            link.classList.toggle(
                "active",
                isActive
            );


            /*
               Accessibility:
               Indicates the current navigation item.
            */

            if (isActive) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );

            }

        }
    );

}



/* =========================
   SCROLL HANDLER
========================= */

/*
   Instead of running multiple heavy operations
   for every browser scroll event, we group them
   into requestAnimationFrame.

   This improves performance on long pages,
   especially on mobile devices.
*/

function handleScroll() {

    if (scrollScheduled) {

        return;

    }


    scrollScheduled =
        true;


    window.requestAnimationFrame(
        () => {

            handleHeaderScroll();

            updateActiveNavigation();


            scrollScheduled =
                false;

        }
    );

}



/* =========================
   SCROLL EVENT
========================= */

window.addEventListener(
    "scroll",
    handleScroll,
    {
        passive: true
    }
);



/* =========================
   WINDOW RESIZE
========================= */

window.addEventListener(
    "resize",
    () => {

        /*
           If the browser changes from mobile
           to desktop width while menu is open,
           remove the mobile menu state.
        */

        if (
            window.innerWidth > 768
        ) {

            closeMobileMenu();

        }


        updateActiveNavigation();

    }
);



/* =========================
   INITIALIZE PAGE
========================= */

handleHeaderScroll();

updateActiveNavigation();