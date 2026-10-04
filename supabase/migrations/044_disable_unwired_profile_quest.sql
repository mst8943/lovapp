-- Profil düzenleme için ödül akışı yok; tamamlanmış gibi gösterilen görevi kapat.
update public.daily_quests
set is_active = false
where slug = 'polish-profile';
