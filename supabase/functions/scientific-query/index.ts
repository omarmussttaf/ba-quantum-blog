// BA Search v0.5.0
// Scientific Query Intelligence

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL =
  Deno.env.get(
    "OPENAI_SCIENTIFIC_LANGUAGE_MODEL"
  ) || "gpt-5.6-terra";


Deno.serve(async (req) => {

    // Handle CORS preflight requests.

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      }
    );
  }

  // BA Security: Scientific Query is disabled by default.
  // Do not enable before authorization and rate limiting are implemented.

  if (
    Deno.env.get("BA_ENABLE_SCIENTIFIC_QUERY") !== "true"
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Scientific Query is temporarily disabled.",
      },
      503
    );
  }

  try {

    const {
      query
    } =
      await req.json();


    if (
      !query ||
      typeof query !== "string"
    ) {

      return jsonResponse(
        {
          ok: false,
          error: "Missing query",
        },
        400
      );

    }


    const cleanQuery =
      query.trim();


    if (!cleanQuery) {

      return jsonResponse(
        {
          ok: false,
          error: "Empty query",
        },
        400
      );

    }


    const apiKey =
      Deno.env.get(
        "OPENAI_API_KEY"
      );


    if (!apiKey) {

      return jsonResponse(
        {
          ok: false,
          error:
            "OPENAI_API_KEY is not configured",
        },
        500
      );

    }


    const detectedLanguage =
      detectLanguage(
        cleanQuery
      );


    const result =
      await analyzeScientificQuery(
        cleanQuery,
        detectedLanguage,
        apiKey
      );


    return jsonResponse(
      {
        ok: true,

        version:
          "v0.5.0",

        engine:
          "BA Scientific Query Intelligence",

        ...result,
      }
    );

  }

  catch (error) {

    console.error(
      "scientific-query error:",
      error
    );


    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      500
    );

  }

});


async function analyzeScientificQuery(
  query: string,
  detectedLanguage: string,
  apiKey: string
) {

  const systemPrompt = `
You are BA Scientific Query Intelligence.

You do NOT answer the research question.

Your task is to understand the scientific meaning of the user's query
and create high-quality scientific search formulations in Arabic and English.

IMPORTANT RULES:

1. Understand scientifically before translating.
2. Do not translate word-by-word if a standard scientific term exists.
3. Preserve scientific acronyms and technical names such as:
   CRISPR-Cas9, DNA, RNA, QAOA, CNN, GKP, p-tau181, Li-ion.
4. Separate the scientific topic from search constraints.
5. Detect document type intent:
   article
   review
   systematic-review
   meta-analysis
   preprint
   book-chapter
   none
6. Detect explicit open-access intent.
7. "peer review" does NOT mean a review article.
8. Arabic and English canonical queries must have equivalent scientific meaning.
9. Canonical queries should be concise and optimized for academic search.
10. Query variants must improve retrieval without changing the user's research intent.
11. Do not invent diseases, methods, mechanisms, applications, or claims.
12. protectedTerms should contain scientific terms that should not be freely translated or modified.
13. Return valid JSON only.

Detected input language:
${detectedLanguage}

Return exactly this structure:

{
  "queryLanguage": "ar | en | other",

  "originalQuery": "original user query",

  "scientificQueries": {

    "ar": {
      "canonical": "scientifically normalized Arabic query",
      "variants": [
        "variant 1",
        "variant 2"
      ]
    },

    "en": {
      "canonical": "scientifically normalized English query",
      "variants": [
        "variant 1",
        "variant 2"
      ]
    }

  },

  "coreConcepts": [
    {
      "en": "English scientific concept",
      "ar": "Arabic scientific concept",
      "aliases": []
    }
  ],

  "protectedTerms": [],

  "constraints": {
    "documentType":
      "none | article | review | systematic-review | meta-analysis | preprint | book-chapter",

    "openAccess": false
  },

  "confidence": 0.0
}
`;


  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {

        method: "POST",

        headers: {

          "Authorization":
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",

        },

        body:
          JSON.stringify(
            {

              model: MODEL,

              instructions:
                systemPrompt,

              input:
                `Scientific query:\n${query}`,

            }
          ),

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "OpenAI error:",
      data
    );


    throw new Error(
      data?.error?.message ||
      `OpenAI request failed: ${response.status}`
    );

  }


  const outputText =
    extractOutputText(
      data
    );


  if (!outputText) {

    throw new Error(
      "No output returned from scientific language model"
    );

  }


  let parsed;


  try {

    parsed =
      JSON.parse(
        cleanJsonText(
          outputText
        )
      );

  }

  catch (error) {

    console.error(
      "Invalid JSON:",
      outputText
    );


    throw new Error(
      "Scientific query model returned invalid JSON"
    );

  }


  return normalizeResult(
    parsed,
    query,
    detectedLanguage
  );

}



function extractOutputText(
  response: any
) {

  if (
    typeof response?.output_text ===
    "string"
  ) {

    return response.output_text.trim();

  }


  const output =
    Array.isArray(
      response?.output
    )
      ? response.output
      : [];


  const texts: string[] = [];


  for (
    const item
    of output
  ) {

    const content =
      Array.isArray(
        item?.content
      )
        ? item.content
        : [];


    for (
      const part
      of content
    ) {

      if (
        typeof part?.text ===
        "string"
      ) {

        texts.push(
          part.text
        );

      }

    }

  }


  return texts
    .join("")
    .trim();

}



function normalizeResult(
  result: any,
  originalQuery: string,
  detectedLanguage: string
) {

  const allowedTypes =
    new Set(
      [
        "none",
        "article",
        "review",
        "systematic-review",
        "meta-analysis",
        "preprint",
        "book-chapter",
      ]
    );


  const documentType =
    allowedTypes.has(
      result?.constraints
        ?.documentType
    )
      ? result.constraints.documentType
      : "none";


  return {

    queryLanguage:
      ["ar", "en", "other"]
        .includes(
          result?.queryLanguage
        )
        ? result.queryLanguage
        : detectedLanguage,


    originalQuery,


    scientificQueries: {

      ar: {

        canonical:
          cleanText(
            result?.scientificQueries
              ?.ar
              ?.canonical
          ),

        variants:
          cleanArray(
            result?.scientificQueries
              ?.ar
              ?.variants
          ),

      },


      en: {

        canonical:
          cleanText(
            result?.scientificQueries
              ?.en
              ?.canonical
          ),

        variants:
          cleanArray(
            result?.scientificQueries
              ?.en
              ?.variants
          ),

      },

    },


    coreConcepts:
      Array.isArray(
        result?.coreConcepts
      )
        ? result.coreConcepts
            .slice(0, 12)
            .map(
              (concept: any) => ({
                en:
                  cleanText(
                    concept?.en
                  ),

                ar:
                  cleanText(
                    concept?.ar
                  ),

                aliases:
                  cleanArray(
                    concept?.aliases
                  ),
              })
            )
            .filter(
              (concept: any) =>
                concept.en ||
                concept.ar
            )
        : [],


    protectedTerms:
      cleanArray(
        result?.protectedTerms
      ),


    constraints: {

      documentType,

      openAccess:
        Boolean(
          result?.constraints
            ?.openAccess
        ),

    },


    confidence:
      clamp(
        Number(
          result?.confidence || 0
        ),
        0,
        1
      ),

  };

}



function detectLanguage(
  text: string
) {

  const arabic =
    (
      text.match(
        /[\u0600-\u06FF]/g
      ) || []
    ).length;


  const english =
    (
      text.match(
        /[A-Za-z]/g
      ) || []
    ).length;


  const total =
    arabic +
    english;


  if (
    total === 0
  ) {

    return "other";

  }


  if (
    arabic / total >=
    0.55
  ) {

    return "ar";

  }


  if (
    english / total >=
    0.55
  ) {

    return "en";

  }


  return "other";

}



function cleanText(
  value: any
) {

  if (
    typeof value !==
    "string"
  ) {

    return "";

  }


  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}



function cleanArray(
  value: any
) {

  if (
    !Array.isArray(
      value
    )
  ) {

    return [];

  }


  return [
    ...new Set(
      value
        .filter(
          (item) =>
            typeof item ===
            "string"
        )
        .map(
          (item) =>
            cleanText(
              item
            )
        )
        .filter(Boolean)
    )
  ]
    .slice(
      0,
      8
    );

}



function cleanJsonText(
  text: string
) {

  return text
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /```$/,
      ""
    )
    .trim();

}



function clamp(
  value: number,
  min: number,
  max: number
) {

  if (
    !Number.isFinite(
      value
    )
  ) {

    return min;

  }


  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );

}



function jsonResponse(
  data: any,
  status = 200
) {

  return new Response(
    JSON.stringify(
      data
    ),
    {

      status,

      headers: {

        ...corsHeaders,

        "Content-Type":
          "application/json",

      },

    }
  );

}