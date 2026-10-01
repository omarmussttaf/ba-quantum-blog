// BA Search v0.4 — Step 3
// Edge Function: embed-papers
// Purpose: generate ONE stored paper embedding per invocation.
// This keeps semantic work separate from research-search and avoids CPU spikes.

const EMBEDDING_MODEL =
  "gte-small";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(
  async (request) => {

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            CORS_HEADERS,
        },
      );
    }

    // Only POST requests are allowed.
if (request.method !== "POST") {
  return jsonResponse(
    {
      ok: false,
      error: "Method not allowed",
    },
    405,
  );
}

// BA Embedding Worker Authentication
const expectedWorkerSecret =
  Deno.env.get("BA_EMBED_WORKER_SECRET");

const providedWorkerSecret =
  request.headers.get("x-ba-worker-secret");

// Fail closed if the server secret is missing.
if (!expectedWorkerSecret) {
  console.error(
    "BA_EMBED_WORKER_SECRET is not configured."
  );

  return jsonResponse(
    {
      ok: false,
      error: "Worker configuration error",
    },
    503,
  );
}

// Reject requests without the correct secret.
if (
  !providedWorkerSecret ||
  providedWorkerSecret !== expectedWorkerSecret
) {
  return jsonResponse(
    {
      ok: false,
      error: "Unauthorized",
    },
    401,
  );
}

    try {

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing Supabase server credentials.",
          },
          500,
        );
      }

      const paper =
        await getNextPaper(
          supabaseUrl,
          serviceRoleKey,
        );

      if (!paper) {
        return jsonResponse(
          {
            ok: true,
            processed: 0,
            message:
              "No papers waiting for embeddings.",
          },
        );
      }

      const content =
        String(
          paper.embedding_content ||
          "",
        )
          .trim()
          .slice(
            0,
            7000,
          );

      if (!content) {

        await markSkippedPaper(
          supabaseUrl,
          serviceRoleKey,
          paper.id,
        );

        return jsonResponse(
          {
            ok: true,
            processed: 0,
            skipped: 1,
            paperId:
              paper.id,
            reason:
              "empty-embedding-content",
          },
        );
      }

      /*
        IMPORTANT:
        We generate only ONE embedding per invocation.
        research-search never performs this work.
      */
      const session =
        new Supabase.ai.Session(
          EMBEDDING_MODEL,
        );

      const output =
        await session.run(
          content,
          {
            mean_pool:
              true,
            normalize:
              true,
          },
        );

      const embedding =
        Array.from(
          output as
            ArrayLike<number>,
        );

      if (
        embedding.length === 0
      ) {
        throw new Error(
          "Embedding model returned an empty vector.",
        );
      }

      await saveEmbedding(
        supabaseUrl,
        serviceRoleKey,
        paper.id,
        embedding,
      );

      return jsonResponse(
        {
          ok: true,
          processed: 1,
          paperId:
            paper.id,
          title:
            paper.title,
          model:
            EMBEDDING_MODEL,
          dimensions:
            embedding.length,
        },
      );

    }

    catch (error) {

      console.error(
        "embed-papers error:",
        error,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown embedding worker error.",
        },
        500,
      );

    }

  },
);


async function getNextPaper(
  supabaseUrl: string,
  serviceRoleKey: string,
) {

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ba_papers`,
    );

  url.searchParams.set(
    "select",
    "id,title,embedding_content",
  );

  url.searchParams.set(
    "embedding",
    "is.null",
  );

  url.searchParams.set(
    "embedding_content",
    "not.is.null",
  );

  url.searchParams.set(
    "order",
    "id.asc",
  );

  url.searchParams.set(
    "limit",
    "1",
  );

  const response =
    await fetch(
      url.toString(),
      {
        headers:
          serverHeaders(
            serviceRoleKey,
          ),
      },
    );

  if (!response.ok) {

    const body =
      await response.text();

    throw new Error(
      `Unable to read ba_papers (${response.status}): ${body.slice(0, 500)}`,
    );

  }

  const rows =
    await response.json();

  if (
    !Array.isArray(
      rows,
    ) ||
    rows.length === 0
  ) {
    return null;
  }

  return rows[0];

}


async function saveEmbedding(
  supabaseUrl: string,
  serviceRoleKey: string,
  paperId: number,
  embedding: number[],
) {

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ba_papers`,
    );

  url.searchParams.set(
    "id",
    `eq.${paperId}`,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "PATCH",

        headers: {
          ...serverHeaders(
            serviceRoleKey,
          ),
          "Content-Type":
            "application/json",
          Prefer:
            "return=minimal",
        },

        body:
          JSON.stringify(
            {
              embedding,
              embedding_model:
                EMBEDDING_MODEL,
              embedding_updated_at:
                new Date()
                  .toISOString(),
              updated_at:
                new Date()
                  .toISOString(),
            },
          ),
      },
    );

  if (!response.ok) {

    const body =
      await response.text();

    throw new Error(
      `Unable to save embedding (${response.status}): ${body.slice(0, 500)}`,
    );

  }

}


async function markSkippedPaper(
  supabaseUrl: string,
  serviceRoleKey: string,
  paperId: number,
) {

  const url =
    new URL(
      `${supabaseUrl}/rest/v1/ba_papers`,
    );

  url.searchParams.set(
    "id",
    `eq.${paperId}`,
  );

  await fetch(
    url.toString(),
    {
      method:
        "PATCH",

      headers: {
        ...serverHeaders(
          serviceRoleKey,
        ),
        "Content-Type":
          "application/json",
        Prefer:
          "return=minimal",
      },

      body:
        JSON.stringify(
          {
            embedding_model:
              "skipped-empty",
            embedding_updated_at:
              new Date()
                .toISOString(),
            updated_at:
              new Date()
                .toISOString(),
          },
        ),
    },
  );

}


function serverHeaders(
  serviceRoleKey: string,
) {

  return {
    apikey:
      serviceRoleKey,

    Authorization:
      `Bearer ${serviceRoleKey}`,
  };

}


function jsonResponse(
  payload: unknown,
  status =
    200,
) {

  return new Response(
    JSON.stringify(
      payload,
      null,
      2,
    ),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    },
  );

}
