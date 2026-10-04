-- Contact details and delivery bookkeeping for membership applications.

alter table public.membership_applications
  add column if not exists phone_e164 text,
  add column if not exists notification_consent boolean not null default false,
  add column if not exists receipt_email_sent_at timestamptz,
  add column if not exists receipt_sms_sent_at timestamptz,
  add column if not exists decision_email_sent_at timestamptz,
  add column if not exists decision_sms_sent_at timestamptz,
  add column if not exists invitation_sms_sent_at timestamptz,
  add column if not exists notification_last_error text;

alter table public.membership_applications
  drop constraint if exists membership_applications_phone_e164_check;

alter table public.membership_applications
  add constraint membership_applications_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^\+905[0-9]{9}$');

create unique index if not exists membership_applications_phone_unique
  on public.membership_applications (phone_e164)
  where phone_e164 is not null;
