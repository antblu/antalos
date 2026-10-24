-- :identities is a base64-encoded JSON snapshot, passed with psql --set.
-- Resolve accounts by email and keep the native OIDC subject/provider links.
WITH desired AS (
    SELECT jsonb_array_elements(convert_from(decode(:'identities', 'base64'), 'UTF8')::jsonb) AS identity
), updated AS (
    UPDATE users AS account
    SET role = (jsonb_populate_record(NULL::users, jsonb_build_object(
        'role', CASE WHEN desired.identity->'groups' ? 'cal-diy-admins' THEN 'ADMIN' ELSE 'USER' END
    ))).role
    FROM desired
    WHERE lower(account.email) = lower(desired.identity->>'email')
      AND account."identityProvider"::text = 'OIDC'
      AND account.role::text <> CASE WHEN desired.identity->'groups' ? 'cal-diy-admins' THEN 'ADMIN' ELSE 'USER' END
    RETURNING account.id
)
SELECT count(*) AS synchronized_caldiy_roles FROM updated;
