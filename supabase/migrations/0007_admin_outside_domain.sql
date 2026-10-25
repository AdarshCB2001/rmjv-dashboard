-- The portal is for @spintly.com staff, but FunKustoms' own admin signs in from another
-- domain. The domain rule now lives only in the app (isAllowedEmail: allowed domain OR an
-- address in ADMIN_EMAILS); the table just insists on lower-case.
alter table allowed_users drop constraint if exists allowed_users_email_domain;
alter table allowed_users add constraint allowed_users_email_lower check (email = lower(email));
