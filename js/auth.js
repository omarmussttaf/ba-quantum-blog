/* =========================================================
   BA SCIENCE
   File: auth.js

   Purpose:
   Handles:
   - Language switching on authentication pages
   - User signup
   - User login
   - Basic client-side validation

   Security Notes:
   - Passwords are never stored manually by BA.
   - Authentication is handled by Supabase Auth.
   - Never log passwords, sessions, access tokens,
     refresh tokens, or full authentication responses.
   - Client-side validation improves UX only.
     Supabase/backend security remains authoritative.
========================================================= */


/* =========================
   ELEMENTS
========================= */

const languageButton =
    document.querySelector("#languageButton");



/* =========================
   LANGUAGE
========================= */

let currentLanguage =
    localStorage.getItem("ba-language") || "ar";


function changeLanguage(language) {

    const safeLanguage =
        language === "en"
            ? "en"
            : "ar";


    const elements =
        document.querySelectorAll(
            "[data-ar][data-en]"
        );


    elements.forEach((element) => {

        element.textContent =
            element.dataset[safeLanguage];

    });


    const placeholderElements =
        document.querySelectorAll(
            "[data-placeholder-ar][data-placeholder-en]"
        );


    placeholderElements.forEach((element) => {

        element.placeholder =
            safeLanguage === "ar"
                ? element.dataset.placeholderAr
                : element.dataset.placeholderEn;

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



    /* BA Science — localized page title */

    const isSignupPage =
        Boolean(document.getElementById("signupForm"));

    document.title =
        isSignupPage
            ? (
                safeLanguage === "ar"
                    ? "BA Science | إنشاء حساب"
                    : "BA Science | Sign Up"
            )
            : (
                safeLanguage === "ar"
                    ? "BA Science | تسجيل الدخول"
                    : "BA Science | Sign In"
            );

    currentLanguage =
        safeLanguage;


    localStorage.setItem(
        "ba-language",
        safeLanguage
    );

}


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

        }
    );

}


changeLanguage(
    currentLanguage
);



/* =========================
   HELPERS
========================= */

/*
   SECURITY:
   This only checks whether the frontend Supabase client exists.
   It does NOT replace Supabase authentication or RLS.
*/

function ensureSupabaseClient() {

    if (!window.baSupabase) {

        throw new Error(
            "BA: Supabase client is not available."
        );

    }

}



/*
   Basic email format validation.

   This is for user experience only.
   Supabase still performs the authoritative validation.
*/

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}



/*
   Password rule for BA v0.1.

   We require at least 8 characters.

   Later we can add:
   - compromised password checks
   - password strength meter
   - MFA
*/

function isValidPassword(password) {

    return (
        typeof password === "string" &&
        password.length >= 8
    );

}



/*
   Shows a safe generic authentication message.

   SECURITY:
   Avoid showing raw backend/database errors directly
   to users in production.
*/

function showAuthMessage(
    arabicMessage,
    englishMessage
) {

    alert(
        currentLanguage === "ar"
            ? arabicMessage
            : englishMessage
    );

}



/* =========================
   SIGN UP
========================= */

const signupForm =
    document.querySelector("#signupForm");


if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const fullNameElement =
                document.querySelector(
                    "#fullName"
                );


            const emailElement =
                document.querySelector(
                    "#email"
                );


            const passwordElement =
                document.querySelector(
                    "#password"
                );


            const accountTypeElement =
                document.querySelector(
                    "#accountType"
                );


            const fieldElement =
                document.querySelector(
                    "#field"
                );


            const submitButton =
                signupForm.querySelector(
                    ".auth-submit"
                );


            /*
               Defensive check.

               If HTML changes later and one of these
               elements disappears, we fail safely.
            */

            if (
                !fullNameElement ||
                !emailElement ||
                !passwordElement ||
                !accountTypeElement ||
                !fieldElement ||
                !submitButton
            ) {

                console.error(
                    "BA: Signup form configuration is incomplete."
                );

                return;

            }


            const fullName =
                fullNameElement.value
                    .trim();


            const email =
                emailElement.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordElement.value;


            const accountType =
                accountTypeElement.value;


            const field =
                fieldElement.value;



            /* =========================
               SIGNUP VALIDATION
            ========================= */

            if (!fullName) {

                showAuthMessage(
                    "يرجى إدخال الاسم الكامل.",
                    "Please enter your full name."
                );

                return;

            }


            if (!isValidEmail(email)) {

                showAuthMessage(
                    "يرجى إدخال بريد إلكتروني صحيح.",
                    "Please enter a valid email address."
                );

                return;

            }


            if (!isValidPassword(password)) {

                showAuthMessage(
                    "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
                    "Password must contain at least 8 characters."
                );

                return;

            }


            if (!accountType) {

                showAuthMessage(
                    "يرجى اختيار نوع الحساب.",
                    "Please select an account type."
                );

                return;

            }


            if (!field) {

                showAuthMessage(
                    "يرجى اختيار المجال العلمي.",
                    "Please select a scientific field."
                );

                return;

            }



            /* =========================
               DISABLE BUTTON
            ========================= */

            submitButton.disabled =
                true;


            submitButton.textContent =
                currentLanguage === "ar"
                    ? "جارٍ إنشاء الحساب..."
                    : "Creating Account...";



            /* =========================
               CREATE ACCOUNT
            ========================= */

            try {

                ensureSupabaseClient();


                const {
                    data,
                    error
                } =
                    await window.baSupabase.auth
                        .signUp({

                            email,

                            password,

                            options: {

                                data: {

                                    full_name:
                                        fullName,

                                    account_type:
                                        accountType,

                                    scientific_field:
                                        field

                                }

                            }

                        });


                if (error) {

                    /*
                       SECURITY:
                       Full error is logged only for development.
                       Do not expose raw error details to users.
                    */

                    console.error(
                        "BA signup error:",
                        error
                    );


                    showAuthMessage(
                        "تعذر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.",
                        "Unable to create the account. Please check your information and try again."
                    );


                    return;

                }


                /*
                   SECURITY:
                   Do not console.log(data) here.

                   Supabase auth responses may contain
                   session-related information.
                */


                if (!data.user) {

                    console.error(
                        "BA: Signup completed without a user object."
                    );


                    showAuthMessage(
                        "تعذر إكمال إنشاء الحساب.",
                        "Unable to complete account creation."
                    );


                    return;

                }


                showAuthMessage(
                    "تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني إذا كان التأكيد مطلوبًا.",
                    "Account created successfully. Check your email if verification is required."
                );


                window.location.href =
                    "./login.html";

            }

            catch (error) {

                console.error(
                    "BA signup unexpected error:",
                    error
                );


                showAuthMessage(
                    "تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.",
                    "Unable to connect to the service right now. Please try again."
                );

            }

            finally {

                submitButton.disabled =
                    false;


                submitButton.textContent =
                    currentLanguage === "ar"
                        ? "إنشاء الحساب"
                        : "Create Account";

            }

        }
    );

}



/* =========================
   LOGIN
========================= */

const loginForm =
    document.querySelector("#loginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const emailElement =
                document.querySelector(
                    "#loginEmail"
                );


            const passwordElement =
                document.querySelector(
                    "#loginPassword"
                );


            const submitButton =
                loginForm.querySelector(
                    ".auth-submit"
                );


            if (
                !emailElement ||
                !passwordElement ||
                !submitButton
            ) {

                console.error(
                    "BA: Login form configuration is incomplete."
                );

                return;

            }


            const email =
                emailElement.value
                    .trim()
                    .toLowerCase();


            const password =
                passwordElement.value;



            /* =========================
               LOGIN VALIDATION
            ========================= */

            if (!isValidEmail(email)) {

                showAuthMessage(
                    "يرجى إدخال بريد إلكتروني صحيح.",
                    "Please enter a valid email address."
                );

                return;

            }


            if (!password) {

                showAuthMessage(
                    "يرجى إدخال كلمة المرور.",
                    "Please enter your password."
                );

                return;

            }



            /* =========================
               DISABLE BUTTON
            ========================= */

            submitButton.disabled =
                true;


            submitButton.textContent =
                currentLanguage === "ar"
                    ? "جارٍ تسجيل الدخول..."
                    : "Signing In...";



            /* =========================
               SIGN IN
            ========================= */

            try {

                ensureSupabaseClient();


                const {
                    data,
                    error
                } =
                    await window.baSupabase.auth
                        .signInWithPassword({

                            email,

                            password

                        });


                if (error) {

                    /*
                       SECURITY:
                       Use the same message for invalid email/password.

                       Do not reveal whether an email account exists.
                    */

                    console.error(
                        "BA login error:",
                        error
                    );


                    showAuthMessage(
                        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
                        "Incorrect email or password."
                    );


                    return;

                }


                /*
                   SECURITY:
                   Never log full auth data/session.
                */

                if (!data.user) {

                    console.error(
                        "BA: Login completed without a user object."
                    );


                    showAuthMessage(
                        "تعذر إكمال تسجيل الدخول.",
                        "Unable to complete sign in."
                    );


                    return;

                }


                window.location.href =
                    "./profile.html";

            }

            catch (error) {

                console.error(
                    "BA login unexpected error:",
                    error
                );


                showAuthMessage(
                    "تعذر الاتصال بالخدمة حاليًا. حاول مرة أخرى.",
                    "Unable to connect to the service right now. Please try again."
                );

            }

            finally {

                submitButton.disabled =
                    false;


                submitButton.textContent =
                    currentLanguage === "ar"
                        ? "تسجيل الدخول"
                        : "Sign In";

            }

        }
    );

}