


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$

begin

    insert into public.profiles (
        id,
        full_name,
        account_type,
        scientific_field
    )

    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'account_type',
        new.raw_user_meta_data ->> 'scientific_field'
    );

    return new;

end;

$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_ba_papers"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT 20, "match_threshold" double precision DEFAULT 0.45) RETURNS TABLE("id" bigint, "canonical_key" "text", "doi" "text", "openalex_id" "text", "title" "text", "abstract" "text", "authors" "jsonb", "publication_year" integer, "journal_name" "text", "document_type" "text", "is_open_access" boolean, "cited_by_count" integer, "source_url" "text", "sources" "jsonb", "semantic_similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select
    p.id,
    p.canonical_key,
    p.doi,
    p.openalex_id,
    p.title,
    p.abstract,
    p.authors,
    p.publication_year,
    p.journal_name,
    p.document_type,
    p.is_open_access,
    p.cited_by_count,
    p.source_url,
    p.sources,
    1 - (p.embedding <=> query_embedding) as semantic_similarity
  from public.ba_papers p
  where
    p.embedding is not null
    and 1 - (p.embedding <=> query_embedding) >= match_threshold
  order by p.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 100);
$$;


ALTER FUNCTION "public"."match_ba_papers"("query_embedding" "extensions"."vector", "match_count" integer, "match_threshold" double precision) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ba_papers" (
    "id" bigint NOT NULL,
    "canonical_key" "text" NOT NULL,
    "doi" "text",
    "openalex_id" "text",
    "title" "text" NOT NULL,
    "abstract" "text",
    "authors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "publication_year" integer,
    "journal_name" "text",
    "document_type" "text",
    "is_open_access" boolean DEFAULT false NOT NULL,
    "cited_by_count" integer DEFAULT 0 NOT NULL,
    "source_url" "text",
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "embedding_content" "text",
    "embedding" "extensions"."vector"(384),
    "embedding_model" "text",
    "embedding_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ba_papers" OWNER TO "postgres";


ALTER TABLE "public"."ba_papers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ba_papers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "account_type" "text",
    "scientific_field" "text",
    "bio" "text",
    "institution" "text",
    "country" "text",
    "city" "text",
    "orcid" "text",
    "avatar_url" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "interests" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_papers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "openalex_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "doi" "text",
    "publication_year" integer,
    "source_name" "text",
    "authors" "text"[] DEFAULT '{}'::"text"[],
    "is_open_access" boolean DEFAULT false,
    "cited_by_count" integer DEFAULT 0,
    "source_url" "text",
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_papers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ba_papers"
    ADD CONSTRAINT "ba_papers_canonical_key_key" UNIQUE ("canonical_key");



ALTER TABLE ONLY "public"."ba_papers"
    ADD CONSTRAINT "ba_papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_papers"
    ADD CONSTRAINT "saved_papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_papers"
    ADD CONSTRAINT "saved_papers_user_id_openalex_id_key" UNIQUE ("user_id", "openalex_id");



CREATE INDEX "ba_papers_citations_idx" ON "public"."ba_papers" USING "btree" ("cited_by_count" DESC);



CREATE INDEX "ba_papers_doi_idx" ON "public"."ba_papers" USING "btree" ("doi");



CREATE INDEX "ba_papers_embedding_hnsw_idx" ON "public"."ba_papers" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("embedding" IS NOT NULL);



CREATE INDEX "ba_papers_openalex_id_idx" ON "public"."ba_papers" USING "btree" ("openalex_id");



CREATE INDEX "ba_papers_publication_year_idx" ON "public"."ba_papers" USING "btree" ("publication_year" DESC);



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_papers"
    ADD CONSTRAINT "saved_papers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own saved papers" ON "public"."saved_papers" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can save own papers" ON "public"."saved_papers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own saved papers" ON "public"."saved_papers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ba_papers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_papers" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";







































GRANT ALL ON TABLE "public"."ba_papers" TO "anon";
GRANT ALL ON TABLE "public"."ba_papers" TO "authenticated";
GRANT ALL ON TABLE "public"."ba_papers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ba_papers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ba_papers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ba_papers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."saved_papers" TO "anon";
GRANT ALL ON TABLE "public"."saved_papers" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_papers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
