/* =========================================================
   BA SCIENCE
   File: edit-profile.js

   Purpose:
   Handles editing the authenticated user's scientific profile.

   Features:
   - Load current profile
   - Language switching
   - Edit profile fields
   - Scientific interests
   - Avatar selection and preview
   - Avatar validation and upload
   - Save profile changes
   - Redirect unauthenticated users

   Security Notes:
   - Requires an authenticated Supabase user.
   - Real database authorization must still be enforced by RLS.
   - Avatar uploads are limited by type and size.
   - User-entered text is never inserted as HTML.
   - Private keys must never exist in this file.
   - The user's UUID is used as the Storage folder.
========================================================= */


/* =========================
   CONFIGURATION
========================= */

/*
   Avatar rules for BA v0.1.

   IMPORTANT:
   Frontend validation improves UX only.

   Storage policies and backend/database rules remain
   the real security boundary.
*/

const MAX_AVATAR_SIZE =
    5 * 1024 * 1024; // 5 MB


const ALLOWED_AVATAR_TYPES =
    [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


const ALLOWED_ACCOUNT_TYPES =
    [
        "student",
        "researcher",
        "professor",
        "engineer",
        "professional",
        "science-enthusiast"
    ];



/* =========================
   ELEMENTS
========================= */

const languageButton =
    document.querySelector(
        "#languageButton"
    );


const editProfileForm =
    document.querySelector(
        "#editProfileForm"
    );


const messageBox =
    document.querySelector(
        "#editProfileMessage"
    );


const saveButton =
    document.querySelector(
        "#saveProfileButton"
    );


const avatarInput =
    document.querySelector(
        "#avatarInput"
    );


const avatarChooseButton =
    document.querySelector(
        "#avatarChooseButton"
    );


const avatarPreview =
    document.querySelector(
        "#avatarPreview"
    );


const avatarPlaceholder =
    document.querySelector(
        "#avatarPlaceholder"
    );


const interestInput =
    document.querySelector(
        "#interestInput"
    );


const addInterestButton =
    document.querySelector(
        "#addInterestButton"
    );


const interestsList =
    document.querySelector(
        "#interestsList"
    );



/* =========================
   STATE
========================= */

let currentLanguage =
    localStorage.getItem(
        "ba-language"
    ) || "ar";


let currentUser =
    null;


let selectedAvatarFile =
    null;


let currentAvatarUrl =
    null;


let previewObjectUrl =
    null;


let interests =
    [];



/* =========================
   LANGUAGE
========================= */

function changeLanguage(language) {

    /*
       BA currently supports only Arabic and English.

       Any unexpected value falls back to Arabic.
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

    document.title =
        safeLanguage === "ar"
            ? "BA Science | تعديل الملف العلمي"
            : "BA Science | Edit Scientific Profile";


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
   SUPABASE CHECK
========================= */

function ensureSupabaseClient() {

    if (!window.baSupabase) {

        throw new Error(
            "BA: Supabase client is not available."
        );

    }

}



/* =========================
   MESSAGE
========================= */

function showMessage(
    message,
    type
) {

    if (!messageBox) {

        console.error(
            "BA: Missing #editProfileMessage"
        );

        return;

    }


    /*
       SECURITY:
       textContent prevents the message from
       being interpreted as HTML.
    */

    messageBox.textContent =
        message;


    messageBox.className =
        `edit-profile-message ${type}`;

}



/* =========================
   FIELD HELPER
========================= */

function getField(
    selector
) {

    return document.querySelector(
        selector
    );

}


function setInputValue(
    selector,
    value
) {

    const element =
        getField(selector);


    if (!element) {

        console.error(
            `BA: Missing form element: ${selector}`
        );

        return;

    }


    element.value =
        value ?? "";

}



/* =========================
   INTERESTS
========================= */

function renderInterests() {

    if (!interestsList) {

        return;

    }


    /*
       Do not use innerHTML for user data.
    */

    interestsList.replaceChildren();


    interests.forEach(
        (interest, index) => {

            const tag =
                document.createElement(
                    "div"
                );


            tag.className =
                "interest-tag";


            const text =
                document.createElement(
                    "span"
                );


            /*
               SECURITY:
               Interests are rendered as plain text.
            */

            text.textContent =
                interest;


            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.type =
                "button";


            removeButton.textContent =
                "×";


            removeButton.setAttribute(
                "aria-label",
                currentLanguage === "ar"
                    ? `حذف ${interest}`
                    : `Remove ${interest}`
            );


            removeButton.addEventListener(
                "click",
                () => {

                    interests.splice(
                        index,
                        1
                    );


                    renderInterests();

                }
            );


            tag.appendChild(
                text
            );


            tag.appendChild(
                removeButton
            );


            interestsList.appendChild(
                tag
            );

        }
    );

}



function addInterest() {

    if (!interestInput) {

        return;

    }


    const value =
        interestInput.value
            .trim();


    if (!value) {

        return;

    }


    /*
       Keep interests reasonably small.

       This prevents someone from putting enormous
       strings into a simple tag field.
    */

    if (value.length > 80) {

        showMessage(
            currentLanguage === "ar"
                ? "الاهتمام العلمي طويل جدًا. الحد الأقصى 80 حرفًا."
                : "Scientific interest is too long. Maximum length is 80 characters.",
            "error"
        );

        return;

    }


    /*
       Limit number of interests for BA v0.1.
    */

    if (interests.length >= 20) {

        showMessage(
            currentLanguage === "ar"
                ? "يمكن إضافة 20 اهتمامًا علميًا كحد أقصى."
                : "You can add up to 20 scientific interests.",
            "error"
        );

        return;

    }


    /*
       Prevent duplicates ignoring letter case.

       Example:
       Physics
       physics

       are treated as the same interest.
    */

    const alreadyExists =
        interests.some(
            (interest) =>
                interest.toLowerCase() ===
                value.toLowerCase()
        );


    if (alreadyExists) {

        interestInput.value =
            "";

        return;

    }


    interests.push(
        value
    );


    interestInput.value =
        "";


    renderInterests();

}


if (
    addInterestButton &&
    interestInput
) {

    addInterestButton.addEventListener(
        "click",
        addInterest
    );


    interestInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addInterest();

            }

        }
    );

}



/* =========================
   AVATAR VALIDATION
========================= */

function validateAvatarFile(
    file
) {

    if (!file) {

        return {
            valid: false,
            message: ""
        };

    }


    /*
       SECURITY:
       Do not trust the filename extension alone.

       MIME type is checked here.
    */

    if (
        !ALLOWED_AVATAR_TYPES.includes(
            file.type
        )
    ) {

        return {
            valid: false,

            message:
                currentLanguage === "ar"
                    ? "نوع الصورة غير مسموح. استخدم JPG أو PNG أو WebP فقط."
                    : "Unsupported image type. Use JPG, PNG or WebP only."
        };

    }


    if (
        file.size >
        MAX_AVATAR_SIZE
    ) {

        return {
            valid: false,

            message:
                currentLanguage === "ar"
                    ? "حجم الصورة كبير جدًا. الحد الأقصى هو 5 MB."
                    : "The image is too large. Maximum size is 5 MB."
        };

    }


    return {
        valid: true,
        message: ""
    };

}



/* =========================
   AVATAR PREVIEW
========================= */

function showAvatarPlaceholder() {

    if (avatarPreview) {

        avatarPreview.style.display =
            "none";

    }


    if (avatarPlaceholder) {

        avatarPlaceholder.style.display =
            "grid";

    }

}



function showAvatarImage(
    url
) {

    if (
        !avatarPreview ||
        !avatarPlaceholder
    ) {

        return;

    }


    avatarPreview.onload =
        () => {

            avatarPreview.style.display =
                "block";


            avatarPlaceholder.style.display =
                "none";

        };


    avatarPreview.onerror =
        () => {

            showAvatarPlaceholder();

        };


    avatarPreview.src =
        url;

}



/* =========================
   CHOOSE AVATAR
========================= */

if (
    avatarChooseButton &&
    avatarInput
) {

    avatarChooseButton.addEventListener(
        "click",
        () => {

            avatarInput.click();

        }
    );

}



/* =========================
   AVATAR INPUT
========================= */

if (avatarInput) {

    avatarInput.addEventListener(
        "change",
        () => {

            const file =
                avatarInput.files?.[0];


            if (!file) {

                return;

            }


            const validation =
                validateAvatarFile(
                    file
                );


            if (!validation.valid) {

                showMessage(
                    validation.message,
                    "error"
                );


                avatarInput.value =
                    "";


                selectedAvatarFile =
                    null;


                return;

            }


            selectedAvatarFile =
                file;


            /*
               Revoke previous local preview URL
               to avoid unnecessary browser memory use.
            */

            if (previewObjectUrl) {

                URL.revokeObjectURL(
                    previewObjectUrl
                );

            }


            previewObjectUrl =
                URL.createObjectURL(
                    file
                );


            showAvatarImage(
                previewObjectUrl
            );

        }
    );

}



/* =========================
   SAFE WEBSITE URL
========================= */

function normalizeWebsiteUrl(
    value
) {

    const trimmed =
        value.trim();


    if (!trimmed) {

        return "";

    }


    let normalized =
        trimmed;


    if (
        !normalized.startsWith(
            "http://"
        ) &&
        !normalized.startsWith(
            "https://"
        )
    ) {

        normalized =
            `https://${normalized}`;

    }


    try {

        const url =
            new URL(
                normalized
            );


        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {

            return null;

        }


        return url.href;

    }

    catch {

        return null;

    }

}



/* =========================
   ORCID VALIDATION
========================= */

/*
   BA v0.1 performs basic ORCID format validation.

   Full ORCID checksum validation can be added later.

   Accepted example:
   0000-0002-1825-0097
*/

function isValidOrcid(
    value
) {

    if (!value) {

        return true;

    }


    return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i
        .test(value);

}



/* =========================
   LOAD CURRENT PROFILE
========================= */

async function loadEditProfile() {

    try {

        ensureSupabaseClient();



        /* =========================
           GET AUTHENTICATED USER
        ========================= */

        const {
            data: userData,
            error: userError
        } =
            await window.baSupabase.auth
                .getUser();


        if (
            userError ||
            !userData?.user
        ) {

            window.location.replace(
                "./login.html"
            );


            return;

        }


        currentUser =
            userData.user;



        /* =========================
           GET PROFILE
        ========================= */

        /*
           Request only fields needed on this page.

           RLS remains responsible for enforcing
           which rows the user can access.
        */

        const {
            data: profile,
            error: profileError
        } =
            await window.baSupabase
                .from("profiles")
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
                    currentUser.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "BA: Unable to load profile."
            );


            showMessage(
                currentLanguage === "ar"
                    ? "تعذر تحميل الملف العلمي حاليًا."
                    : "Unable to load your scientific profile right now.",
                "error"
            );


            return;

        }


        if (!profile) {

            showMessage(
                currentLanguage === "ar"
                    ? "لم يتم العثور على الملف العلمي."
                    : "Scientific profile not found.",
                "error"
            );


            return;

        }



        /* =========================
           LOAD INTERESTS
        ========================= */

        interests =
            Array.isArray(
                profile.interests
            )
                ? profile.interests
                    .filter(
                        (interest) =>
                            typeof interest ===
                                "string" &&
                            interest.trim()
                    )
                    .map(
                        (interest) =>
                            interest.trim()
                    )
                : [];


        renderInterests();



        /* =========================
           LOAD AVATAR
        ========================= */

        currentAvatarUrl =
            profile.avatar_url ||
            null;


        if (
            currentAvatarUrl &&
            avatarPreview
        ) {

            showAvatarImage(
                currentAvatarUrl
            );

        } else {

            showAvatarPlaceholder();

        }



        /* =========================
           LOAD FORM VALUES
        ========================= */

        setInputValue(
            "#editFullName",
            profile.full_name
        );


        setInputValue(
            "#editAccountType",
            profile.account_type ||
            "student"
        );


        setInputValue(
            "#editScientificField",
            profile.scientific_field
        );


        setInputValue(
            "#editInstitution",
            profile.institution
        );


        setInputValue(
            "#editCountry",
            profile.country
        );


        setInputValue(
            "#editCity",
            profile.city
        );


        setInputValue(
            "#editOrcid",
            profile.orcid
        );


        setInputValue(
            "#editWebsite",
            profile.website
        );


        setInputValue(
            "#editBio",
            profile.bio
        );

    }

    catch (error) {

        console.error(
            "BA: Unexpected edit profile loading error.",
            error
        );


        showMessage(
            currentLanguage === "ar"
                ? "تعذر تحميل الملف العلمي. حاول مرة أخرى."
                : "Unable to load your profile. Please try again.",
            "error"
        );

    }

}



/* =========================
   AVATAR UPLOAD
========================= */

async function uploadAvatar() {

    if (!selectedAvatarFile) {

        return null;

    }


    if (!currentUser) {

        throw new Error(
            "BA: Cannot upload avatar without authenticated user."
        );

    }


    const validation =
        validateAvatarFile(
            selectedAvatarFile
        );


    if (!validation.valid) {

        throw new Error(
            "BA: Invalid avatar file."
        );

    }



    /* =========================
       SAFE FILE EXTENSION
    ========================= */

    /*
       Extension is derived from the validated MIME type,
       not from the original user-provided filename.
    */

    const extensionMap =
        {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };


    const extension =
        extensionMap[
            selectedAvatarFile.type
        ];


    /*
       Random UUID prevents predictable file names
       and collisions between uploads.
    */

    const randomName =
        crypto.randomUUID();


    const fileName =
        `${randomName}.${extension}`;


    /*
       SECURITY:

       Storage RLS should require that the first
       folder matches auth.uid().
    */

    const filePath =
        `${currentUser.id}/${fileName}`;



    /* =========================
       UPLOAD FILE
    ========================= */

    const {
        error: uploadError
    } =
        await window.baSupabase.storage
            .from("avatars")
            .upload(
                filePath,
                selectedAvatarFile,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType:
                        selectedAvatarFile.type
                }
            );


    if (uploadError) {

        console.error(
            "BA: Avatar upload failed."
        );


        throw new Error(
            "AVATAR_UPLOAD_FAILED"
        );

    }



    /* =========================
       GET PUBLIC URL
    ========================= */

    const {
        data: publicUrlData
    } =
        window.baSupabase.storage
            .from("avatars")
            .getPublicUrl(
                filePath
            );


    const publicUrl =
        publicUrlData?.publicUrl;


    if (!publicUrl) {

        throw new Error(
            "BA: Avatar public URL was not generated."
        );

    }


    return publicUrl;

}



/* =========================
   FORM SUBMIT
========================= */

if (
    editProfileForm &&
    saveButton
) {

    editProfileForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            if (!currentUser) {

                showMessage(
                    currentLanguage === "ar"
                        ? "انتهت جلسة تسجيل الدخول. سجل الدخول مرة أخرى."
                        : "Your session has expired. Please sign in again.",
                    "error"
                );


                return;

            }



            /* =========================
               READ FORM VALUES
            ========================= */

            const fullName =
                getField(
                    "#editFullName"
                )?.value
                    .trim() || "";


            const accountType =
                getField(
                    "#editAccountType"
                )?.value || "";


            const scientificField =
                getField(
                    "#editScientificField"
                )?.value
                    .trim() || "";


            const institution =
                getField(
                    "#editInstitution"
                )?.value
                    .trim() || "";


            const country =
                getField(
                    "#editCountry"
                )?.value
                    .trim() || "";


            const city =
                getField(
                    "#editCity"
                )?.value
                    .trim() || "";


            const orcid =
                getField(
                    "#editOrcid"
                )?.value
                    .trim() || "";


            const rawWebsite =
                getField(
                    "#editWebsite"
                )?.value
                    .trim() || "";


            const bio =
                getField(
                    "#editBio"
                )?.value
                    .trim() || "";



            /* =========================
               VALIDATION
            ========================= */

            if (!fullName) {

                showMessage(
                    currentLanguage === "ar"
                        ? "يرجى إدخال الاسم الكامل."
                        : "Please enter your full name.",
                    "error"
                );


                return;

            }


            if (
                fullName.length > 120
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "الاسم طويل جدًا."
                        : "The name is too long.",
                    "error"
                );


                return;

            }


            if (
                !ALLOWED_ACCOUNT_TYPES.includes(
                    accountType
                )
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "نوع الحساب غير صالح."
                        : "Invalid account type.",
                    "error"
                );


                return;

            }


            if (
                scientificField.length >
                120
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "اسم المجال العلمي طويل جدًا."
                        : "Scientific field is too long.",
                    "error"
                );


                return;

            }


            if (
                institution.length >
                160
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "اسم المؤسسة طويل جدًا."
                        : "Institution name is too long.",
                    "error"
                );


                return;

            }


            if (
                city.length > 100 ||
                country.length > 100
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "بيانات الموقع طويلة جدًا."
                        : "Location information is too long.",
                    "error"
                );


                return;

            }


            if (
                !isValidOrcid(
                    orcid
                )
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "صيغة ORCID غير صحيحة. مثال: 0000-0002-1825-0097"
                        : "Invalid ORCID format. Example: 0000-0002-1825-0097",
                    "error"
                );


                return;

            }


            const website =
                normalizeWebsiteUrl(
                    rawWebsite
                );


            if (
                rawWebsite &&
                website === null
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "رابط الموقع الشخصي غير صالح."
                        : "The personal website URL is invalid.",
                    "error"
                );


                return;

            }


            if (
                bio.length > 2000
            ) {

                showMessage(
                    currentLanguage === "ar"
                        ? "النبذة طويلة جدًا. الحد الأقصى 2000 حرف."
                        : "Bio is too long. Maximum length is 2000 characters.",
                    "error"
                );


                return;

            }



            /* =========================
               START SAVING
            ========================= */

            saveButton.disabled =
                true;


            saveButton.textContent =
                currentLanguage === "ar"
                    ? "جارٍ الحفظ..."
                    : "Saving...";


            if (messageBox) {

                messageBox.textContent =
                    "";

            }



            try {

                ensureSupabaseClient();



                /* =========================
                   UPLOAD NEW AVATAR
                ========================= */

                const newAvatarUrl =
                    await uploadAvatar();



                /* =========================
                   UPDATE PROFILE
                ========================= */

                const updateData =
                    {

                        full_name:
                            fullName,

                        account_type:
                            accountType,

                        scientific_field:
                            scientificField,

                        interests:
                            interests,

                        institution:
                            institution,

                        country:
                            country,

                        city:
                            city,

                        orcid:
                            orcid,

                        website:
                            website || "",

                        bio:
                            bio,

                        updated_at:
                            new Date()
                                .toISOString()

                    };


                /*
                   Only update avatar_url if the user
                   selected and successfully uploaded
                   a new image.
                */

                if (newAvatarUrl) {

                    updateData.avatar_url =
                        newAvatarUrl;

                }



                /*
                   SECURITY:

                   This .eq(id, currentUser.id) is useful,
                   but it is NOT sufficient authorization.

                   Supabase RLS must independently prevent
                   users from updating another user's row.
                */

                const {
                    error: updateError
                } =
                    await window.baSupabase
                        .from("profiles")
                        .update(
                            updateData
                        )
                        .eq(
                            "id",
                            currentUser.id
                        );


                if (updateError) {

                    console.error(
                        "BA: Profile update failed."
                    );


                    throw new Error(
                        "PROFILE_UPDATE_FAILED"
                    );

                }



                /* =========================
                   SUCCESS
                ========================= */

                showMessage(
                    currentLanguage === "ar"
                        ? "تم حفظ التغييرات بنجاح."
                        : "Changes saved successfully.",
                    "success"
                );


                setTimeout(
                    () => {

                        window.location.replace(
                            "./profile.html"
                        );

                    },
                    700
                );

            }

            catch (error) {

                console.error(
                    "BA: Unable to save profile.",
                    error
                );


                let arabicMessage =
                    "تعذر حفظ التغييرات. حاول مرة أخرى.";


                let englishMessage =
                    "Unable to save your changes. Please try again.";


                if (
                    error.message ===
                    "AVATAR_UPLOAD_FAILED"
                ) {

                    arabicMessage =
                        "تعذر رفع الصورة. تحقق من الصورة وحاول مرة أخرى.";


                    englishMessage =
                        "Unable to upload the image. Please check the image and try again.";

                }


                showMessage(
                    currentLanguage === "ar"
                        ? arabicMessage
                        : englishMessage,
                    "error"
                );

            }

            finally {

                saveButton.disabled =
                    false;


                saveButton.textContent =
                    currentLanguage === "ar"
                        ? "حفظ التغييرات"
                        : "Save Changes";

            }

        }
    );

}



/* =========================
   CLEANUP
========================= */

/*
   Release temporary browser memory used
   for local image preview.
*/

window.addEventListener(
    "beforeunload",
    () => {

        if (previewObjectUrl) {

            URL.revokeObjectURL(
                previewObjectUrl
            );

        }

    }
);



/* =========================
   START
========================= */

loadEditProfile();