-- A reply is definitive acceptance of a message request, regardless of whether
-- it came from a human client, bot automation, or an administrative flow.
create or replace function public.accept_message_request_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matches
  set connection_type = 'direct_chat',
      request_status = 'accepted',
      request_expires_at = null,
      closed_at = null
  where id = new.match_id
    and status = 'active'
    and connection_type = 'message_request'
    and request_status in ('draft', 'pending')
    and request_sender_id is distinct from new.sender_id;
  return new;
end;
$$;

drop trigger if exists messages_accept_request_on_reply on public.messages;
create trigger messages_accept_request_on_reply
after insert on public.messages
for each row execute function public.accept_message_request_on_reply();

-- Repair existing conversations where the recipient already replied but the
-- request row remained pending because the reply bypassed the response RPC.
update public.matches m
set connection_type = 'direct_chat',
    request_status = 'accepted',
    request_expires_at = null,
    closed_at = null
where m.status = 'active'
  and m.connection_type = 'message_request'
  and m.request_status in ('draft', 'pending')
  and exists (
    select 1
    from public.messages msg
    where msg.match_id = m.id
      and msg.sender_id is distinct from m.request_sender_id
  );

revoke all on function public.accept_message_request_on_reply() from public;
