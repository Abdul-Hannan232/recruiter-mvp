-- Bootstrap pgvector extension on first container start.
CREATE EXTENSION IF NOT EXISTS vector;

-- NOTE: the live schema is built by SQLAlchemy (Base.metadata.create_all in
-- app/database/session.py:init_db) from the ORM models in app/models/db.py.
-- The block below mirrors that schema faithfully for manual bootstraps and
-- documents the Talent Pool rule: a candidate's job_id is nullable and is
-- CLEARED (not cascaded) when its referenced JD is deleted, so the candidate
-- survives in the pool. Everything here is idempotent and column/enum/type
-- exact, so it never conflicts with create_all (which skips existing objects).

-- Candidate lifecycle enum. Labels are the CandidateStatus member NAMES, which
-- is what SQLAlchemy's Enum(CandidateStatus) emits and binds (POOL, not pool).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
        CREATE TYPE candidate_status AS ENUM (
            'POOL', 'MATCHED', 'OUTREACH_SENT', 'INTERVIEWING',
            'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'HIRED', 'REJECTED'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS job_descriptions (
    id              UUID PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    requirements_text TEXT NOT NULL,
    jd_embedding    VECTOR(768),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
    id                   UUID PRIMARY KEY,
    -- Talent Pool: unassigned at intake; cleared (SET NULL) when the JD is deleted.
    job_id               UUID REFERENCES job_descriptions(id) ON DELETE SET NULL,
    full_name            VARCHAR(200) NOT NULL,
    email                VARCHAR(200) NOT NULL,
    original_resume_text TEXT NOT NULL,
    resume_embedding     VECTOR(768),
    ai_evaluation_score  FLOAT,
    status               candidate_status NOT NULL DEFAULT 'POOL',
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_candidates_email ON candidates (email);
