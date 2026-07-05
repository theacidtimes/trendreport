alter table reports
  alter column report drop not null,
  add column status text not null default 'ready',
  add column error_message text;

alter table reports
  add constraint reports_status_check check (status in ('pending', 'ready', 'error'));
